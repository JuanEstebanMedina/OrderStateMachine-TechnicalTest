from app.domain.order_event import OrderEventType
from app.domain.order_state import OrderState


class DomainError(Exception):
    pass


class OrderNotFoundError(DomainError):
    pass


class InvalidOrderTransitionError(DomainError):
    def __init__(self, current_state: OrderState, event_type: OrderEventType) -> None:
        self.current_state = current_state
        self.event_type = event_type
        super().__init__(
            f"Invalid order transition from {current_state.value} with event {event_type.value}"
        )
