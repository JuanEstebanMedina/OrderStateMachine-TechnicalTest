from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.domain.order_event import OrderEventType
from app.domain.order_state import OrderState


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class OrderEventLog:
    event_type: OrderEventType
    from_state: OrderState
    to_state: OrderState
    metadata: dict[str, Any]
    created_at: datetime = field(default_factory=utc_now)


@dataclass
class Order:
    id: str
    product_ids: list[str]
    amount: float
    current_state: OrderState = OrderState.PENDING
    history: list[OrderEventLog] = field(default_factory=list)
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)
