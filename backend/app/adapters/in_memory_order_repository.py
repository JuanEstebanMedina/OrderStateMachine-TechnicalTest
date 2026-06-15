from copy import deepcopy
from uuid import UUID

from app.adapters.in_memory_store import InMemoryStore
from app.domain import (
    Order,
    OrderEventLog,
    OrderSummary,
    OrderVersionConflictError,
    SupportTicket,
)
from app.ports import OrderRepository


class InMemoryOrderRepository(OrderRepository):
    def __init__(self, store: InMemoryStore | None = None) -> None:
        self._store = store or InMemoryStore()

    def create(self, order: Order) -> Order:
        order_lock = self._store.get_order_lock(order.id)
        with order_lock:
            with self._store.get_registry_lock():
                if order.id in self._store.orders:
                    raise ValueError(f"Order {order.id} already exists")

                self._store.orders[order.id] = deepcopy(order)
            return deepcopy(order)

    def get_by_id(self, order_id: UUID) -> Order | None:
        order_lock = self._store.get_order_lock(order_id)
        with order_lock:
            with self._store.get_registry_lock():
                order = self._store.orders.get(order_id)
            if order is None:
                return None
            return deepcopy(order)

    def list_summaries(self) -> list[OrderSummary]:
        with self._store.get_registry_lock():
            orders = list(self._store.orders.values())

        return [
            OrderSummary(
                id=order.id,
                product_ids=deepcopy(order.product_ids),
                amount=order.amount,
                current_state=order.current_state,
                created_at=order.created_at,
                updated_at=order.updated_at,
            )
            for order in orders
        ]

    def commit_transition(
        self,
        order: Order,
        event_log: OrderEventLog,
        support_ticket: SupportTicket | None,
        expected_version: int,
    ) -> Order:
        order_lock = self._store.get_order_lock(order.id)

        with order_lock:
            with self._store.get_registry_lock():
                stored_order = self._store.orders.get(order.id)
            if (
                stored_order is None
                or stored_order.version != expected_version
                or stored_order.current_state != event_log.from_state
            ):
                raise OrderVersionConflictError(order.id, expected_version)

            with self._store.get_registry_lock():
                self._store.orders[order.id] = deepcopy(order)

                if support_ticket is not None:
                    self._store.tickets[support_ticket.id] = deepcopy(support_ticket)

            return deepcopy(order)
