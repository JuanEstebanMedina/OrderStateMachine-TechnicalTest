from copy import deepcopy
from uuid import UUID

from app.domain import SupportTicket
from app.ports import SupportTicketRepository


class InMemorySupportTicketRepository(SupportTicketRepository):
    def __init__(self) -> None:
        self._tickets: dict[UUID, SupportTicket] = {}

    def save(self, ticket: SupportTicket) -> SupportTicket:
        self._tickets[ticket.id] = deepcopy(ticket)
        return deepcopy(ticket)

    def get_by_id(self, ticket_id: UUID) -> SupportTicket | None:
        ticket = self._tickets.get(ticket_id)
        if ticket is None:
            return None
        return deepcopy(ticket)

    def list_all(self) -> list[SupportTicket]:
        return [deepcopy(ticket) for ticket in self._tickets.values()]

    def list_by_order_id(self, order_id: UUID) -> list[SupportTicket]:
        return [
            deepcopy(ticket)
            for ticket in self._tickets.values()
            if ticket.order_id == order_id
        ]
