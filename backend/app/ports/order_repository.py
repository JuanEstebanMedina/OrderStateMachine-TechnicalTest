from typing import Protocol
from uuid import UUID

from app.domain import Order, OrderEventLog, OrderSummary, SupportTicket


class OrderRepository(Protocol):
    def create(self, order: Order) -> Order:
        ...

    def get_by_id(self, order_id: UUID) -> Order | None:
        ...

    def list_summaries(self) -> list[OrderSummary]:
        ...

    def commit_transition(
        self,
        order: Order,
        event_log: OrderEventLog,
        support_ticket: SupportTicket | None,
        expected_version: int,
    ) -> Order:
        """Atomic persistence boundary for an order state transition.

        `expected_version` is the caller's optimistic-lock version. Stale
        versions must raise `OrderVersionConflictError`; implementations must
        commit the order update, event, and optional ticket together or leave no
        partial writes behind.
        """
        ...
