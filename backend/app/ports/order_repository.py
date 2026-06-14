from typing import Protocol
from uuid import UUID

from app.domain import Order


class OrderRepository(Protocol):
    def save(self, order: Order) -> Order:
        ...

    def get_by_id(self, order_id: UUID) -> Order | None:
        ...

    def list_all(self) -> list[Order]:
        ...
