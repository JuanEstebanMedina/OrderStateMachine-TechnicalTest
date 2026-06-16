from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest
from botocore.exceptions import ClientError

from app.adapters.dynamodb_mapper import order_to_item, serialize_item
from app.adapters.dynamodb_order_repository import DynamoDBOrderRepository
from app.domain import (
    Order,
    OrderEventLog,
    OrderEventType,
    OrderState,
    OrderVersionConflictError,
    SupportTicket,
)


ORDER_ID = UUID("11111111-1111-1111-1111-111111111111")
SECOND_ORDER_ID = UUID("11111111-1111-1111-1111-111111111112")
EVENT_ID = UUID("22222222-2222-2222-2222-222222222222")
TICKET_ID = UUID("33333333-3333-3333-3333-333333333333")
CREATED_AT = datetime(2026, 6, 13, 12, 4, 5, tzinfo=timezone.utc)
UPDATED_AT = datetime(2026, 6, 13, 12, 5, 6, tzinfo=timezone.utc)


class FakeDynamoDBClient:
    def __init__(
        self,
        error: ClientError | None = None,
        query_responses: list[dict[str, Any]] | None = None,
    ) -> None:
        self.exceptions = SimpleNamespace(
            ConditionalCheckFailedException=ClientError,
            TransactionCanceledException=ClientError,
        )
        self.error = error
        self.query_responses = query_responses or []
        self.query_calls: list[dict[str, Any]] = []
        self.transact_write_items_calls: list[dict[str, Any]] = []

    def transact_write_items(self, **kwargs: Any) -> dict[str, Any]:
        self.transact_write_items_calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return {}

    def query(self, **kwargs: Any) -> dict[str, Any]:
        self.query_calls.append(kwargs)
        return self.query_responses.pop(0)


def cancelled_error(reasons: list[dict[str, str]]) -> ClientError:
    return ClientError(
        {
            "Error": {
                "Code": "TransactionCanceledException",
                "Message": "Transaction cancelled",
            },
            "CancellationReasons": reasons,
        },
        "TransactWriteItems",
    )


def build_order(order_id: UUID = ORDER_ID) -> Order:
    return Order(
        id=order_id,
        product_ids=["product-1"],
        amount=1200.5,
        current_state=OrderState.PENDING_PAYMENT,
        created_at=CREATED_AT,
        updated_at=UPDATED_AT,
        version=1,
    )


def build_event() -> OrderEventLog:
    return OrderEventLog(
        id=EVENT_ID,
        event_type=OrderEventType.NO_VERIFICATION_NEEDED,
        from_state=OrderState.PENDING,
        to_state=OrderState.PENDING_PAYMENT,
        metadata={"source": "unit"},
        created_at=UPDATED_AT,
    )


def build_ticket() -> SupportTicket:
    return SupportTicket(
        id=TICKET_ID,
        order_id=ORDER_ID,
        reason="High-value order payment failed",
        metadata={"source": "unit"},
        created_at=UPDATED_AT,
    )


def repository_with_error(error: ClientError) -> tuple[DynamoDBOrderRepository, FakeDynamoDBClient]:
    client = FakeDynamoDBClient(error=error)
    return DynamoDBOrderRepository(client, "Orders"), client


def test_first_operation_conditional_failure_becomes_version_conflict() -> None:
    repository, client = repository_with_error(
        cancelled_error([{"Code": "ConditionalCheckFailed"}])
    )

    with pytest.raises(OrderVersionConflictError):
        repository.commit_transition(
            build_order(),
            build_event(),
            build_ticket(),
            expected_version=0,
        )

    transact_items = client.transact_write_items_calls[0]["TransactItems"]
    assert "Update" in transact_items[0]
    assert "Put" in transact_items[1]
    assert "Put" in transact_items[2]


def test_first_operation_transaction_conflict_remains_aws_exception() -> None:
    error = cancelled_error([{"Code": "TransactionConflict"}])
    repository, _client = repository_with_error(error)

    with pytest.raises(ClientError) as raised:
        repository.commit_transition(
            build_order(),
            build_event(),
            None,
            expected_version=0,
        )

    assert raised.value is error


def test_later_operation_conditional_failure_remains_aws_exception() -> None:
    error = cancelled_error(
        [
            {"Code": "None"},
            {"Code": "ConditionalCheckFailed"},
        ]
    )
    repository, _client = repository_with_error(error)

    with pytest.raises(ClientError) as raised:
        repository.commit_transition(
            build_order(),
            build_event(),
            build_ticket(),
            expected_version=0,
        )

    assert raised.value is error


def test_list_summaries_follows_query_pagination() -> None:
    order = build_order()
    second_order = build_order(SECOND_ORDER_ID)
    last_evaluated_key = {
        "PK": {"S": f"ORDER#{ORDER_ID}"},
        "SK": {"S": "ORDER"},
    }
    client = FakeDynamoDBClient(
        query_responses=[
            {
                "Items": [serialize_item(order_to_item(order))],
                "LastEvaluatedKey": last_evaluated_key,
            },
            {"Items": [serialize_item(order_to_item(second_order))]},
        ]
    )
    repository = DynamoDBOrderRepository(client, "Orders")

    summaries = repository.list_summaries()

    assert [summary.id for summary in summaries] == [ORDER_ID, SECOND_ORDER_ID]
    assert client.query_calls[1]["ExclusiveStartKey"] == last_evaluated_key
