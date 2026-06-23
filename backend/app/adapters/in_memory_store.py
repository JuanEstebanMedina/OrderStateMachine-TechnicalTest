from threading import Lock
from uuid import UUID

from app.domain import Order, SupportTicket


class InMemoryStore:
    def __init__(self) -> None:
        self.orders: dict[UUID, Order] = {}
        self.tickets: dict[UUID, SupportTicket] = {}
        self._registry_lock = Lock()
        self._order_locks: dict[UUID, Lock] = {}

    def get_order_lock(self, order_id: UUID) -> Lock:
        with self._registry_lock:
            lock = self._order_locks.get(order_id)
            if lock is None:
                # Locks are allocated per order so independent transitions do
                # not serialize through one global mutation lock.
                lock = Lock()
                self._order_locks[order_id] = lock
            return lock

    def get_registry_lock(self) -> Lock:
        return self._registry_lock
