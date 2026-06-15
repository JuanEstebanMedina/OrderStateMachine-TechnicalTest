from app.domain.order_event import OrderEventType
from app.domain.order_state import OrderState
from uuid import UUID


class DomainError(Exception):
    pass


class OrderNotFoundError(DomainError):
    pass


class OrderVersionConflictError(DomainError):
    def __init__(self, order_id: UUID, expected_version: int) -> None:
        self.order_id = order_id
        self.expected_version = expected_version
        super().__init__(
            f"Order {order_id} changed before version {expected_version} could be committed"
        )


class InvalidOrderTransitionError(DomainError):
    def __init__(self, current_state: OrderState, event_type: OrderEventType) -> None:
        self.current_state = current_state
        self.event_type = event_type
        super().__init__(
            f"Invalid order transition from {current_state.value} with event {event_type.value}"
        )
