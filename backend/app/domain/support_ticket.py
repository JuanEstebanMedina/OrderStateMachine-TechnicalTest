from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class SupportTicket:
    id: str
    order_id: str
    reason: str
    metadata: dict[str, Any]
    created_at: datetime = field(default_factory=utc_now)
