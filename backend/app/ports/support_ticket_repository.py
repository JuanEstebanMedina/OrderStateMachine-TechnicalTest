from typing import Protocol

from app.domain import SupportTicket


class SupportTicketRepository(Protocol):
    def save(self, ticket: SupportTicket) -> SupportTicket:
        ...

    def get_by_id(self, ticket_id: str) -> SupportTicket | None:
        ...

    def list_all(self) -> list[SupportTicket]:
        ...

    def list_by_order_id(self, order_id: str) -> list[SupportTicket]:
        ...
