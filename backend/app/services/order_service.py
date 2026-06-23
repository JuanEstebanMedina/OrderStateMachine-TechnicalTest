from copy import deepcopy
from datetime import datetime, timezone
from typing import Any
from uuid import UUID
import uuid

from app.domain import (
    Order,
    OrderEventLog,
    OrderEventType,
    OrderSummary,
    OrderNotFoundError,
    OrderState,
    SupportTicket,
)
from app.ports import OrderRepository
from app.services.state_machine import OrderStateMachine


class OrderService:
    def __init__(
        self,
        order_repository: OrderRepository,
        state_machine: OrderStateMachine,
    ) -> None:
        self._order_repository = order_repository
        self._state_machine = state_machine

    def create_order(
        self,
        product_ids: list[str],
        amount: float,
    ) -> Order:
        order = Order(
            id=uuid.uuid4(),
            product_ids=product_ids,
            amount=amount,
            current_state=OrderState.PENDING,
        )

        return self._order_repository.create(order)

    def get_order(self, order_id: UUID) -> Order:
        order = self._order_repository.get_by_id(order_id)
        if order is None:
            raise OrderNotFoundError(f"Order {order_id} not found")

        return order

    def list_orders(self) -> list[OrderSummary]:
        return self._order_repository.list_summaries()

    def apply_event(
        self,
        order_id: UUID,
        event_type: OrderEventType,
        metadata: dict[str, Any] | None = None,
    ) -> Order:
        order = self.get_order(order_id)
        event_metadata = deepcopy(metadata) if metadata is not None else {}
        expected_version = order.version
        from_state = order.current_state
        to_state = self._state_machine.get_next_state(from_state, event_type)
        timestamp = self._utc_now()

        # Validate the transition before constructing persistence records, then
        # hand the order update, event, and optional side effect to one atomic
        # repository operation.
        event_log = OrderEventLog(
            id=uuid.uuid4(),
            event_type=event_type,
            from_state=from_state,
            to_state=to_state,
            metadata=deepcopy(event_metadata),
            created_at=timestamp,
        )
        updated_order = Order(
            id=order.id,
            product_ids=deepcopy(order.product_ids),
            amount=order.amount,
            current_state=to_state,
            history=[*deepcopy(order.history), deepcopy(event_log)],
            created_at=order.created_at,
            updated_at=timestamp,
            version=expected_version + 1,
        )
        support_ticket = self._build_support_ticket(
            order=updated_order,
            event_type=event_type,
            metadata=event_metadata,
            created_at=timestamp,
        )

        return self._order_repository.commit_transition(
            order=updated_order,
            event_log=event_log,
            support_ticket=support_ticket,
            expected_version=expected_version,
        )

    def _build_support_ticket(
        self,
        order: Order,
        event_type: OrderEventType,
        metadata: dict[str, Any],
        created_at: datetime,
    ) -> SupportTicket | None:
        if event_type != OrderEventType.PAYMENT_FAILED or order.amount <= 1000:
            return None

        return SupportTicket(
            id=uuid.uuid4(),
            order_id=order.id,
            reason="High-value order payment failed",
            metadata={
                "order_amount": order.amount,
                "event_metadata": deepcopy(metadata),
            },
            created_at=created_at,
        )

    def _utc_now(self) -> datetime:
        return datetime.now(timezone.utc)
