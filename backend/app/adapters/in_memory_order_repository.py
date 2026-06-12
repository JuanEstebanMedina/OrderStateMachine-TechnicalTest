from copy import deepcopy

from app.domain import Order
from app.ports import OrderRepository


class InMemoryOrderRepository(OrderRepository):
    def __init__(self) -> None:
        self._orders: dict[str, Order] = {}

    def save(self, order: Order) -> Order:
        self._orders[order.id] = deepcopy(order)
        return deepcopy(order)

    def get_by_id(self, order_id: str) -> Order | None:
        order = self._orders.get(order_id)
        if order is None:
            return None
        return deepcopy(order)

    def list_all(self) -> list[Order]:
        return [deepcopy(order) for order in self._orders.values()]
