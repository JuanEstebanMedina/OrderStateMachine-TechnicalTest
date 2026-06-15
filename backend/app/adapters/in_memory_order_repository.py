from copy import deepcopy
from threading import Lock
from uuid import UUID

from app.domain import Order
from app.ports import OrderRepository


class InMemoryOrderRepository(OrderRepository):
    def __init__(self) -> None:
        self._orders: dict[UUID, Order] = {}
        self._lock = Lock()

    def save(self, order: Order) -> Order:
        with self._lock:
            self._orders[order.id] = deepcopy(order)
            return deepcopy(order)

    def get_by_id(self, order_id: UUID) -> Order | None:
        with self._lock:
            order = self._orders.get(order_id)
            if order is None:
                return None
            return deepcopy(order)

    def list_all(self) -> list[Order]:
        with self._lock:
            return [deepcopy(order) for order in self._orders.values()]
