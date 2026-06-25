from __future__ import annotations

from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
import os
import time
from typing import Any
from uuid import UUID, uuid4

import boto3
import pytest

from app.adapters import DynamoDBOrderRepository
from app.adapters.dynamodb_mapper import (
    EVENT_SK_PREFIX,
    TICKET_SK_PREFIX,
    deserialize_item,
    order_pk,
)
from app.domain import (
    Order,
    OrderEventLog,
    OrderEventType,
    OrderState,
    OrderVersionConflictError,
    SupportTicket,
)
from app.services import OrderService, OrderStateMachine
from rule_test_utils import create_default_rule_engine
from scripts.create_dynamodb_table import build_table_request


pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.getenv("RUN_DYNAMODB_INTEGRATION") != "1",
        reason="Set RUN_DYNAMODB_INTEGRATION=1 to run DynamoDB Local tests.",
    ),
]


@dataclass(frozen=True)
class DynamoContext:
    client: Any
    table_name: str


def create_client() -> Any:
    return boto3.client(
        "dynamodb",
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        endpoint_url=os.getenv("DYNAMODB_ENDPOINT_URL", "http://localhost:8001"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "local"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "local"),
    )


def create_table(client, table_name: str) -> None:
    client.create_table(**build_table_request(table_name))
    client.get_waiter("table_exists").wait(TableName=table_name)


@pytest.fixture
def dynamodb_context() -> Iterator[DynamoContext]:
    client = create_client()
    table_name = f"OrderStateMachineTest-{uuid4()}"
    create_table(client, table_name)

    try:
        yield DynamoContext(client=client, table_name=table_name)
    finally:
        client.delete_table(TableName=table_name)


@pytest.fixture
def order_repository(dynamodb_context: DynamoContext) -> DynamoDBOrderRepository:
    return DynamoDBOrderRepository(dynamodb_context.client, dynamodb_context.table_name)


def build_order(amount: float = 1200.5) -> Order:
    return Order(
        id=uuid4(),
        product_ids=["product-1"],
        amount=amount,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def build_event(
    event_id: UUID | None = None,
    event_type: OrderEventType = OrderEventType.NO_VERIFICATION_NEEDED,
    from_state: OrderState = OrderState.PENDING,
    to_state: OrderState = OrderState.PENDING_PAYMENT,
) -> OrderEventLog:
    return OrderEventLog(
        id=event_id or uuid4(),
        event_type=event_type,
        from_state=from_state,
        to_state=to_state,
        metadata={"source": "integration"},
        created_at=datetime.now(timezone.utc),
    )


def updated_order(order: Order, event_log: OrderEventLog) -> Order:
    return Order(
        id=order.id,
        product_ids=[*order.product_ids],
        amount=order.amount,
        current_state=event_log.to_state,
        history=[*order.history, event_log],
        created_at=order.created_at,
        updated_at=event_log.created_at,
        version=order.version + 1,
    )


def build_ticket(order_id: UUID, ticket_id: UUID | None = None) -> SupportTicket:
    return SupportTicket(
        id=ticket_id or uuid4(),
        order_id=order_id,
        reason="Integration ticket",
        metadata={"source": "integration"},
    )


def wait_for_summaries(repository: DynamoDBOrderRepository, count: int) -> list:
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        summaries = repository.list_summaries()
        if len(summaries) >= count:
            return summaries
        time.sleep(0.1)
    raise AssertionError(f"Timed out waiting for {count} GSI order summaries")


def query_order_items(
    dynamodb_context: DynamoContext,
    order_id: UUID,
    sk_prefix: str,
) -> list[dict]:
    response = dynamodb_context.client.query(
        TableName=dynamodb_context.table_name,
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk_prefix)",
        ExpressionAttributeValues={
            ":pk": {"S": order_pk(order_id)},
            ":sk_prefix": {"S": sk_prefix},
        },
        ConsistentRead=True,
    )
    return [deserialize_item(item) for item in response.get("Items", [])]


def test_create_and_get_order(order_repository: DynamoDBOrderRepository) -> None:
    order = build_order()

    order_repository.create(order)

    assert order_repository.get_by_id(order.id) == order


def test_list_summaries_uses_gsi(order_repository: DynamoDBOrderRepository) -> None:
    order = build_order()
    order_repository.create(order)

    summaries = wait_for_summaries(order_repository, 1)

    assert summaries[0].id == order.id
    assert not hasattr(summaries[0], "history")


def test_commit_transition_and_reconstruct_history(
    order_repository: DynamoDBOrderRepository,
) -> None:
    order = order_repository.create(build_order())
    event = build_event()

    order_repository.commit_transition(updated_order(order, event), event, None, 0)

    retrieved_order = order_repository.get_by_id(order.id)
    assert retrieved_order is not None
    assert retrieved_order.current_state == OrderState.PENDING_PAYMENT
    assert retrieved_order.version == 1
    assert retrieved_order.history == [event]


def test_persist_high_value_payment_failure_ticket(
    order_repository: DynamoDBOrderRepository,
    dynamodb_context: DynamoContext,
) -> None:
    service = OrderService(
        order_repository,
        OrderStateMachine(),
        create_default_rule_engine(),
    )
    order = service.create_order(["product-1"], 1200.5)

    service.apply_event(order.id, OrderEventType.PAYMENT_FAILED, {"source": "test"})

    tickets = query_order_items(dynamodb_context, order.id, TICKET_SK_PREFIX)
    assert len(tickets) == 1
    assert tickets[0]["entityType"] == "SUPPORT_TICKET"
    assert tickets[0]["reason"] == "High-value order payment failed"


def test_monetary_rule_persists_final_amount(
    order_repository: DynamoDBOrderRepository,
) -> None:
    service = OrderService(
        order_repository,
        OrderStateMachine(),
        create_default_rule_engine(),
    )
    order = service.create_order(["product-1"], 1200.0)
    service.apply_event(order.id, OrderEventType.NO_VERIFICATION_NEEDED)

    service.apply_event(
        order.id,
        OrderEventType.PAYMENT_SUCCESSFUL,
        {"destinationCountry": "US"},
    )

    stored_order = order_repository.get_by_id(order.id)
    assert stored_order is not None
    assert stored_order.amount == pytest.approx(1345.0)


def test_state_override_rule_persists_final_state(
    order_repository: DynamoDBOrderRepository,
) -> None:
    service = OrderService(
        order_repository,
        OrderStateMachine(),
        create_default_rule_engine(),
    )
    order = service.create_order(["product-1"], 100.0)
    service.apply_event(order.id, OrderEventType.NO_VERIFICATION_NEEDED)

    service.apply_event(
        order.id,
        OrderEventType.PAYMENT_SUCCESSFUL,
        {"manualReviewRequired": True},
    )

    stored_order = order_repository.get_by_id(order.id)
    assert stored_order is not None
    assert stored_order.current_state == OrderState.ON_HOLD


def test_stale_version_rejection_leaves_no_orphan_items(
    order_repository: DynamoDBOrderRepository,
    dynamodb_context: DynamoContext,
) -> None:
    order = order_repository.create(build_order())
    first_event = build_event()
    stale_event = build_event()
    first_ticket = build_ticket(order.id)
    stale_ticket = build_ticket(order.id)
    first_update = updated_order(order, first_event)
    stale_update = updated_order(order, stale_event)

    order_repository.commit_transition(first_update, first_event, first_ticket, 0)
    with pytest.raises(OrderVersionConflictError):
        order_repository.commit_transition(
            stale_update,
            stale_event,
            stale_ticket,
            expected_version=0,
        )

    events = query_order_items(dynamodb_context, order.id, EVENT_SK_PREFIX)
    tickets = query_order_items(dynamodb_context, order.id, TICKET_SK_PREFIX)

    assert [event["eventId"] for event in events] == [str(first_event.id)]
    assert [ticket["ticketId"] for ticket in tickets] == [str(first_ticket.id)]
    assert str(stale_event.id) not in {event["eventId"] for event in events}
    assert str(stale_ticket.id) not in {ticket["ticketId"] for ticket in tickets}


def test_independent_transitions_for_different_orders(
    order_repository: DynamoDBOrderRepository,
) -> None:
    orders = [order_repository.create(build_order()) for _ in range(4)]

    def commit(order: Order) -> None:
        event = build_event()
        order_repository.commit_transition(updated_order(order, event), event, None, 0)

    with ThreadPoolExecutor(max_workers=4) as executor:
        for future in [executor.submit(commit, order) for order in orders]:
            future.result(timeout=5)

    for order in orders:
        stored_order = order_repository.get_by_id(order.id)

        assert stored_order is not None
        assert stored_order.version == 1
