from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

import pytest

from app.adapters.dynamodb_mapper import (
    deserialize_item,
    event_item_to_event_log,
    event_log_to_item,
    format_utc_timestamp,
    order_item_and_event_items_to_order,
    order_item_to_order,
    order_item_to_order_summary,
    order_to_item,
    serialize_item,
    support_ticket_to_item,
)
from app.domain import Order, OrderEventLog, OrderEventType, OrderState, SupportTicket


ORDER_ID = UUID("11111111-1111-1111-1111-111111111111")
EVENT_ID = UUID("22222222-2222-2222-2222-222222222222")
TICKET_ID = UUID("33333333-3333-3333-3333-333333333333")
CREATED_AT = datetime(2026, 6, 13, 12, 4, 5, 123456, tzinfo=timezone.utc)
UPDATED_AT = datetime(2026, 6, 13, 12, 5, 6, 654321, tzinfo=timezone.utc)


def build_order() -> Order:
    return Order(
        id=ORDER_ID,
        product_ids=["product-1", "product-2"],
        amount=1200.5,
        current_state=OrderState.PENDING_PAYMENT,
        created_at=CREATED_AT,
        updated_at=UPDATED_AT,
        version=2,
    )


def build_event(
    event_id: UUID = EVENT_ID,
    created_at: datetime = UPDATED_AT,
) -> OrderEventLog:
    return OrderEventLog(
        id=event_id,
        event_type=OrderEventType.NO_VERIFICATION_NEEDED,
        from_state=OrderState.PENDING,
        to_state=OrderState.PENDING_PAYMENT,
        metadata={
            "source": "checkout",
            "score": 0.75,
            "nested": [{"amount": 10.5}],
        },
        created_at=created_at,
    )


def test_order_mapping_preserves_domain_values() -> None:
    item = order_to_item(build_order())

    assert item["PK"] == f"ORDER#{ORDER_ID}"
    assert item["SK"] == "ORDER"
    assert item["amount"] == Decimal("1200.5")
    assert item["currentState"] == "PendingPayment"
    assert item["version"] == 2
    assert item["createdAt"] == "2026-06-13T12:04:05.123456Z"
    assert item["GSI1PK"] == "ORDERS"
    assert item["GSI1SK"] == f"2026-06-13T12:04:05.123456Z#{ORDER_ID}"

    mapped_order = order_item_to_order(item)
    assert mapped_order == build_order()


def test_order_summary_mapping_uses_order_item_without_history() -> None:
    summary = order_item_to_order_summary(order_to_item(build_order()))

    assert summary.id == ORDER_ID
    assert summary.product_ids == ["product-1", "product-2"]
    assert summary.amount == pytest.approx(1200.5)
    assert summary.current_state == OrderState.PENDING_PAYMENT


def test_event_mapping_converts_nested_metadata_numbers() -> None:
    item = event_log_to_item(ORDER_ID, build_event())

    assert item["SK"] == f"EVENT#2026-06-13T12:05:06.654321Z#{EVENT_ID}"
    assert item["metadata"]["score"] == Decimal("0.75")
    assert item["metadata"]["nested"][0]["amount"] == Decimal("10.5")

    mapped_event = event_item_to_event_log(item)
    assert mapped_event == build_event()


def test_support_ticket_mapping_preserves_write_item_values() -> None:
    ticket = SupportTicket(
        id=TICKET_ID,
        order_id=ORDER_ID,
        reason="High-value order payment failed",
        metadata={"order_amount": 1200.5, "attempts": 2},
        created_at=UPDATED_AT,
    )
    item = support_ticket_to_item(ticket)

    assert item["PK"] == f"ORDER#{ORDER_ID}"
    assert item["SK"] == f"TICKET#{TICKET_ID}"
    assert item["metadata"]["order_amount"] == Decimal("1200.5")
    assert item["reason"] == "High-value order payment failed"
    assert item["createdAt"] == "2026-06-13T12:05:06.654321Z"


def test_order_item_and_events_reconstruct_complete_order_in_sort_key_order() -> None:
    second_event = build_event(
        event_id=UUID("22222222-2222-2222-2222-222222222223"),
        created_at=datetime(2026, 6, 13, 12, 6, 0, tzinfo=timezone.utc),
    )
    event_items = [
        event_log_to_item(ORDER_ID, second_event),
        event_log_to_item(ORDER_ID, build_event()),
    ]

    order = order_item_and_event_items_to_order(order_to_item(build_order()), event_items)

    assert order.history == [build_event(), second_event]


def test_boto3_serialization_helpers_restore_domain_values() -> None:
    item = order_to_item(build_order())
    serialized = serialize_item(item)
    deserialized = deserialize_item(serialized)

    assert deserialized["amount"] == pytest.approx(1200.5)
    assert deserialized["version"] == 2


def test_timestamp_format_normalizes_to_utc() -> None:
    timestamp = datetime(2026, 6, 13, 7, 4, 5, 123456, tzinfo=timezone.utc)

    assert format_utc_timestamp(timestamp) == "2026-06-13T07:04:05.123456Z"


def test_invalid_required_fields_raise_key_error() -> None:
    item = order_to_item(build_order())
    del item["currentState"]

    with pytest.raises(KeyError):
        order_item_to_order(item)


@pytest.mark.parametrize("amount", [float("nan"), float("inf"), float("-inf")])
def test_order_mapping_rejects_non_finite_amount(amount: float) -> None:
    order = build_order()
    order.amount = amount

    with pytest.raises(ValueError):
        order_to_item(order)


def test_event_mapping_rejects_non_finite_metadata_number() -> None:
    event = build_event()
    event.metadata["bad"] = float("nan")

    with pytest.raises(ValueError):
        event_log_to_item(ORDER_ID, event)
