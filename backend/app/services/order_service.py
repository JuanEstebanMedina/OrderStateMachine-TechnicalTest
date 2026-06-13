from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Callable
import uuid

from app.domain import (
    Order,
    OrderEventLog,
    OrderEventType,
    OrderNotFoundError,
    OrderState,
    SupportTicket,
)
from app.ports import OrderRepository, SupportTicketRepository
from app.services.state_machine import OrderStateMachine


class OrderService:
    def __init__(
        self,
        order_repository: OrderRepository,
        support_ticket_repository: SupportTicketRepository,
        state_machine: OrderStateMachine,
    ) -> None:
        self._order_repository = order_repository
        self._support_ticket_repository = support_ticket_repository
        self._state_machine = state_machine
        self._event_handlers: dict[
            OrderEventType,
            Callable[[Order, dict[str, Any]], None],
        ] = {
            OrderEventType.PAYMENT_FAILED: self._handle_payment_failed,
        }

    def create_order(
        self,
        product_ids: list[str],
        amount: float,
    ) -> Order:
        order = Order(
            id=str(uuid.uuid4()),
            product_ids=product_ids,
            amount=amount,
            current_state=OrderState.PENDING,
        )

        return self._order_repository.save(order)

    def get_order(self, order_id: str) -> Order:
        order = self._order_repository.get_by_id(order_id)
        if order is None:
            raise OrderNotFoundError(f"Order {order_id} not found")

        return order

    def list_orders(self) -> list[Order]:
        return self._order_repository.list_all()

    def apply_event(
        self,
        order_id: str,
        event_type: OrderEventType,
        metadata: dict[str, Any] | None = None,
    ) -> Order:
        order = self.get_order(order_id)
        event_metadata = deepcopy(metadata) if metadata is not None else {}
        from_state = order.current_state
        to_state = self._state_machine.get_next_state(from_state, event_type)

        order.current_state = to_state
        order.updated_at = self._utc_now()
        order.history.append(
            OrderEventLog(
                event_type=event_type,
                from_state=from_state,
                to_state=to_state,
                metadata=deepcopy(event_metadata),
                created_at=self._utc_now(),
            )
        )

        handler = self._event_handlers.get(event_type)
        if handler is not None:
            handler(order, event_metadata)

        return self._order_repository.save(order)

    def _handle_payment_failed(
        self,
        order: Order,
        metadata: dict[str, Any],
    ) -> None:
        if order.amount <= 1000:
            return

        ticket = SupportTicket(
            id=str(uuid.uuid4()),
            order_id=order.id,
            reason="High-value order payment failed",
            metadata={
                "order_amount": order.amount,
                "event_metadata": deepcopy(metadata),
            },
        )

        self._support_ticket_repository.save(ticket)

    def _utc_now(self) -> datetime:
        return datetime.now(timezone.utc)
