from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import UUID


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class SupportTicket:
    id: UUID
    order_id: UUID
    reason: str
    metadata: dict[str, Any]
    created_at: datetime = field(default_factory=utc_now)
