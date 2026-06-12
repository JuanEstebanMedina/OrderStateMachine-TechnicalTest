from typing import Protocol

from app.domain import Order


class OrderRepository(Protocol):
    def save(self, order: Order) -> Order:
        ...

    def get_by_id(self, order_id: str) -> Order | None:
        ...

    def list_all(self) -> list[Order]:
        ...
