from typing import Protocol
from uuid import UUID

from app.domain import SupportTicket


class SupportTicketRepository(Protocol):
    def get_by_id(self, ticket_id: UUID) -> SupportTicket | None:
        ...

    def list_all(self) -> list[SupportTicket]:
        ...

    def list_by_order_id(self, order_id: UUID) -> list[SupportTicket]:
        ...
