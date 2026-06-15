from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
import os
import time
from uuid import UUID, uuid4

import boto3
import pytest
from fastapi.testclient import TestClient

from app.adapters import DynamoDBOrderRepository, DynamoDBSupportTicketRepository
from app.adapters.dynamodb_mapper import (
    EVENT_SK_PREFIX,
    TICKET_SK_PREFIX,
    order_pk,
)
from app.dependencies import get_order_service, get_state_machine
from app.domain import (
    Order,
    OrderEventLog,
    OrderEventType,
    OrderState,
    OrderVersionConflictError,
    SupportTicket,
)
from app.main import app
from app.services import OrderService, OrderStateMachine


pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.getenv("RUN_DYNAMODB_INTEGRATION") != "1",
        reason="Set RUN_DYNAMODB_INTEGRATION=1 to run DynamoDB Local tests.",
    ),
]


@dataclass(frozen=True)
class DynamoContext:
    client: object
    table_name: str


def create_client():
    return boto3.client(
        "dynamodb",
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        endpoint_url=os.getenv("DYNAMODB_ENDPOINT_URL", "http://localhost:8001"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "local"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "local"),
    )


def create_table(client, table_name: str) -> None:
    client.create_table(
        TableName=table_name,
        KeySchema=[
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
            {"AttributeName": "GSI1PK", "AttributeType": "S"},
            {"AttributeName": "GSI1SK", "AttributeType": "S"},
        ],
        GlobalSecondaryIndexes=[
            {
                "IndexName": "GSI1",
                "KeySchema": [
                    {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            }
        ],
        BillingMode="PAY_PER_REQUEST",
    )
    client.get_waiter("table_exists").wait(TableName=table_name)


@pytest.fixture
def dynamodb_context() -> DynamoContext:
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


@pytest.fixture
def ticket_repository(
    dynamodb_context: DynamoContext,
) -> DynamoDBSupportTicketRepository:
    return DynamoDBSupportTicketRepository(
        dynamodb_context.client,
        dynamodb_context.table_name,
    )


def build_order(amount: float = 1200.5) -> Order:
    return Order(
        id=uuid4(),
        product_ids=["product-1"],
        amount=amount,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def build_event(
    event_type: OrderEventType = OrderEventType.NO_VERIFICATION_NEEDED,
    from_state: OrderState = OrderState.PENDING,
    to_state: OrderState = OrderState.PENDING_PAYMENT,
) -> OrderEventLog:
    return OrderEventLog(
        id=uuid4(),
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


def build_ticket(order_id: UUID) -> SupportTicket:
    return SupportTicket(
        id=uuid4(),
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
) -> list:
    response = dynamodb_context.client.query(
        TableName=dynamodb_context.table_name,
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk_prefix)",
        ExpressionAttributeValues={
            ":pk": {"S": order_pk(order_id)},
            ":sk_prefix": {"S": sk_prefix},
        },
        ConsistentRead=True,
    )
    return response.get("Items", [])


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


def test_commit_transition_and_reconstruct_ordered_history(
    order_repository: DynamoDBOrderRepository,
) -> None:
    order = order_repository.create(build_order())
    first_event = build_event()
    first_order = updated_order(order, first_event)
    order_repository.commit_transition(first_order, first_event, None, 0)
    second_event = build_event(
        event_type=OrderEventType.PAYMENT_SUCCESSFUL,
        from_state=OrderState.PENDING_PAYMENT,
        to_state=OrderState.CONFIRMED,
    )
    second_order = updated_order(first_order, second_event)

    order_repository.commit_transition(second_order, second_event, None, 1)

    retrieved_order = order_repository.get_by_id(order.id)
    assert retrieved_order is not None
    assert retrieved_order.current_state == OrderState.CONFIRMED
    assert retrieved_order.version == 2
    assert retrieved_order.history == [first_event, second_event]


def test_persist_high_value_payment_failure_ticket(
    order_repository: DynamoDBOrderRepository,
    ticket_repository: DynamoDBSupportTicketRepository,
) -> None:
    service = OrderService(order_repository, OrderStateMachine())
    order = service.create_order(["product-1"], 1200.5)

    service.apply_event(order.id, OrderEventType.PAYMENT_FAILED, {"source": "test"})

    tickets = ticket_repository.list_by_order_id(order.id)
    assert len(tickets) == 1
    assert tickets[0].reason == "High-value order payment failed"


@pytest.mark.parametrize("amount", [1000.0, 999.99])
def test_no_ticket_for_payment_failure_at_or_below_1000(
    order_repository: DynamoDBOrderRepository,
    ticket_repository: DynamoDBSupportTicketRepository,
    amount: float,
) -> None:
    service = OrderService(order_repository, OrderStateMachine())
    order = service.create_order(["product-1"], amount)

    service.apply_event(order.id, OrderEventType.PAYMENT_FAILED, {"source": "test"})

    assert ticket_repository.list_by_order_id(order.id) == []


def test_two_stale_transitions_allow_exactly_one_success(
    order_repository: DynamoDBOrderRepository,
    dynamodb_context: DynamoContext,
) -> None:
    order = order_repository.create(build_order())

    def commit() -> str:
        event = build_event()
        try:
            order_repository.commit_transition(
                updated_order(order, event),
                event,
                build_ticket(order.id),
                expected_version=0,
            )
        except OrderVersionConflictError:
            return "conflict"
        return "success"

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = [future.result(timeout=5) for future in [executor.submit(commit), executor.submit(commit)]]

    assert sorted(results) == ["conflict", "success"]
    assert len(query_order_items(dynamodb_context, order.id, EVENT_SK_PREFIX)) == 1
    assert len(query_order_items(dynamodb_context, order.id, TICKET_SK_PREFIX)) == 1


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

    assert all(order_repository.get_by_id(order.id).version == 1 for order in orders)


def test_repository_conflict_maps_to_http_409(
    dynamodb_context: DynamoContext,
) -> None:
    class StaleOnCommitRepository(DynamoDBOrderRepository):
        def __init__(self) -> None:
            super().__init__(dynamodb_context.client, dynamodb_context.table_name)
            self._bumped = False

        def get_by_id(self, order_id: UUID) -> Order | None:
            order = super().get_by_id(order_id)
            if order is not None and not self._bumped:
                self._bumped = True
                event = build_event()
                super().commit_transition(updated_order(order, event), event, None, 0)
            return order

    repository = StaleOnCommitRepository()
    state_machine = OrderStateMachine()
    service = OrderService(repository, state_machine)
    app.dependency_overrides[get_order_service] = lambda: service
    app.dependency_overrides[get_state_machine] = lambda: state_machine

    try:
        with TestClient(app) as client:
            created = client.post(
                "/orders",
                json={"productIds": ["product-1"], "amount": 1200.5},
            ).json()
            response = client.post(
                f"/orders/{created['orderId']}/events",
                json={"eventType": "noVerificationNeeded", "metadata": {}},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409


def test_conditional_create_prevents_replacement(
    order_repository: DynamoDBOrderRepository,
) -> None:
    order = build_order()
    order_repository.create(order)

    with pytest.raises(ValueError):
        order_repository.create(order)


def test_gsi_pagination(dynamodb_context: DynamoContext) -> None:
    repository = DynamoDBOrderRepository(
        dynamodb_context.client,
        dynamodb_context.table_name,
        page_size=1,
    )
    orders = [repository.create(build_order()) for _ in range(3)]

    summaries = wait_for_summaries(repository, 3)

    assert {summary.id for summary in summaries} == {order.id for order in orders}


def test_base_table_detail_reads_latest_state(
    order_repository: DynamoDBOrderRepository,
) -> None:
    order = order_repository.create(build_order())
    event = build_event()
    order_repository.commit_transition(updated_order(order, event), event, None, 0)

    retrieved_order = order_repository.get_by_id(order.id)

    assert retrieved_order is not None
    assert retrieved_order.current_state == OrderState.PENDING_PAYMENT
    assert retrieved_order.version == 1
