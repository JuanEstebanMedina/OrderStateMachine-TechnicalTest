from copy import deepcopy
from uuid import UUID

from app.adapters.in_memory_store import InMemoryStore
from app.domain import SupportTicket
from app.ports import SupportTicketRepository


class InMemorySupportTicketRepository(SupportTicketRepository):
    def __init__(self, store: InMemoryStore | None = None) -> None:
        self._store = store or InMemoryStore()

    def list_by_order_id(self, order_id: UUID) -> list[SupportTicket]:
        with self._store.get_registry_lock():
            return [
                deepcopy(ticket)
                for ticket in self._store.tickets.values()
                if ticket.order_id == order_id
            ]
