from datetime import datetime, timezone
from decimal import Decimal
import math
from typing import Any
from uuid import UUID

from boto3.dynamodb.types import TypeDeserializer, TypeSerializer

from app.domain import (
    Order,
    OrderEventLog,
    OrderEventType,
    OrderState,
    OrderSummary,
    SupportTicket,
)


ORDER_SK = "ORDER"
ORDER_ENTITY_TYPE = "ORDER"
ORDER_EVENT_ENTITY_TYPE = "ORDER_EVENT"
SUPPORT_TICKET_ENTITY_TYPE = "SUPPORT_TICKET"
EVENT_SK_PREFIX = "EVENT#"
TICKET_SK_PREFIX = "TICKET#"
GSI1_NAME = "GSI1"
GSI1_ORDERS_PK = "ORDERS"
UTC_TIMESTAMP_FORMAT = "%Y-%m-%dT%H:%M:%S.%fZ"

_serializer = TypeSerializer()
_deserializer = TypeDeserializer()


def order_pk(order_id: UUID) -> str:
    return f"ORDER#{order_id}"


def event_sk(event_log: OrderEventLog) -> str:
    return f"{EVENT_SK_PREFIX}{format_utc_timestamp(event_log.created_at)}#{event_log.id}"


def ticket_sk(ticket_id: UUID) -> str:
    return f"{TICKET_SK_PREFIX}{ticket_id}"


def serialize_item(item: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {key: _serializer.serialize(value) for key, value in item.items()}


def deserialize_item(item: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {
        key: restore_domain_numbers(_deserializer.deserialize(value))
        for key, value in item.items()
    }


def serialize_key(pk: str, sk: str) -> dict[str, dict[str, str]]:
    return serialize_item({"PK": pk, "SK": sk})


def format_utc_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime(UTC_TIMESTAMP_FORMAT)


def parse_utc_timestamp(value: str) -> datetime:
    return datetime.strptime(value, UTC_TIMESTAMP_FORMAT).replace(tzinfo=timezone.utc)


def to_dynamodb_number(value: float | int | Decimal) -> Decimal:
    if isinstance(value, bool):
        raise ValueError("Boolean values are not valid numbers")

    if isinstance(value, Decimal):
        if not value.is_finite():
            raise ValueError("Number must be finite")
        return value

    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("Number must be finite")
        return Decimal(str(value))

    return Decimal(str(value))


def normalize_for_dynamodb(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: normalize_for_dynamodb(item) for key, item in value.items()}

    if isinstance(value, list):
        return [normalize_for_dynamodb(item) for item in value]

    if isinstance(value, tuple):
        return [normalize_for_dynamodb(item) for item in value]

    if isinstance(value, float | int | Decimal) and not isinstance(value, bool):
        return to_dynamodb_number(value)

    return value


def restore_domain_numbers(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: restore_domain_numbers(item) for key, item in value.items()}

    if isinstance(value, list):
        return [restore_domain_numbers(item) for item in value]

    if isinstance(value, Decimal):
        if value.as_tuple().exponent >= 0:
            return int(value)
        return float(value)

    return value


def order_to_item(order: Order) -> dict[str, Any]:
    created_at = format_utc_timestamp(order.created_at)
    return {
        "PK": order_pk(order.id),
        "SK": ORDER_SK,
        "entityType": ORDER_ENTITY_TYPE,
        "orderId": str(order.id),
        "productIds": [*order.product_ids],
        "amount": to_dynamodb_number(order.amount),
        "currentState": order.current_state.value,
        "version": order.version,
        "createdAt": created_at,
        "updatedAt": format_utc_timestamp(order.updated_at),
        "GSI1PK": GSI1_ORDERS_PK,
        "GSI1SK": f"{created_at}#{order.id}",
    }


def order_item_to_order_summary(item: dict[str, Any]) -> OrderSummary:
    return OrderSummary(
        id=UUID(item["orderId"]),
        product_ids=list(item["productIds"]),
        amount=float(item["amount"]),
        current_state=OrderState(item["currentState"]),
        created_at=parse_utc_timestamp(item["createdAt"]),
        updated_at=parse_utc_timestamp(item["updatedAt"]),
    )


def order_item_to_order(item: dict[str, Any]) -> Order:
    return order_item_and_event_items_to_order(item, [])


def event_log_to_item(order_id: UUID, event_log: OrderEventLog) -> dict[str, Any]:
    return {
        "PK": order_pk(order_id),
        "SK": event_sk(event_log),
        "entityType": ORDER_EVENT_ENTITY_TYPE,
        "eventId": str(event_log.id),
        "eventType": event_log.event_type.value,
        "fromState": event_log.from_state.value,
        "toState": event_log.to_state.value,
        "metadata": normalize_for_dynamodb(event_log.metadata),
        "createdAt": format_utc_timestamp(event_log.created_at),
    }


def event_item_to_event_log(item: dict[str, Any]) -> OrderEventLog:
    return OrderEventLog(
        id=UUID(item["eventId"]),
        event_type=OrderEventType(item["eventType"]),
        from_state=OrderState(item["fromState"]),
        to_state=OrderState(item["toState"]),
        metadata=restore_domain_numbers(item["metadata"]),
        created_at=parse_utc_timestamp(item["createdAt"]),
    )


def support_ticket_to_item(ticket: SupportTicket) -> dict[str, Any]:
    return {
        "PK": order_pk(ticket.order_id),
        "SK": ticket_sk(ticket.id),
        "entityType": SUPPORT_TICKET_ENTITY_TYPE,
        "ticketId": str(ticket.id),
        "orderId": str(ticket.order_id),
        "reason": ticket.reason,
        "metadata": normalize_for_dynamodb(ticket.metadata),
        "createdAt": format_utc_timestamp(ticket.created_at),
    }


def ticket_item_to_support_ticket(item: dict[str, Any]) -> SupportTicket:
    return SupportTicket(
        id=UUID(item["ticketId"]),
        order_id=UUID(item["orderId"]),
        reason=item["reason"],
        metadata=restore_domain_numbers(item["metadata"]),
        created_at=parse_utc_timestamp(item["createdAt"]),
    )


def order_item_and_event_items_to_order(
    order_item: dict[str, Any],
    event_items: list[dict[str, Any]],
) -> Order:
    sorted_event_items = sorted(event_items, key=lambda item: item["SK"])
    return Order(
        id=UUID(order_item["orderId"]),
        product_ids=list(order_item["productIds"]),
        amount=float(order_item["amount"]),
        current_state=OrderState(order_item["currentState"]),
        history=[event_item_to_event_log(item) for item in sorted_event_items],
        created_at=parse_utc_timestamp(order_item["createdAt"]),
        updated_at=parse_utc_timestamp(order_item["updatedAt"]),
        version=int(order_item["version"]),
    )
