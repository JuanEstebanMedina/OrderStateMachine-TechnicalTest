from app.domain import InvalidOrderTransitionError, OrderEventType, OrderState


class OrderStateMachine:
    _transitions: dict[tuple[OrderState, OrderEventType], OrderState] = {
        (OrderState.PENDING, OrderEventType.PENDING_BIOMETRICAL_VERIFICATION): OrderState.ON_HOLD,
        (OrderState.PENDING, OrderEventType.NO_VERIFICATION_NEEDED): OrderState.PENDING_PAYMENT,
        (OrderState.PENDING, OrderEventType.PAYMENT_FAILED): OrderState.CANCELLED,
        (OrderState.PENDING, OrderEventType.ORDER_CANCELLED): OrderState.CANCELLED,
        (OrderState.ON_HOLD, OrderEventType.BIOMETRICAL_VERIFICATION_SUCCESSFUL): OrderState.PENDING_PAYMENT,
        (OrderState.ON_HOLD, OrderEventType.VERIFICATION_FAILED): OrderState.CANCELLED,
        (OrderState.ON_HOLD, OrderEventType.ORDER_CANCELLED_BY_USER): OrderState.CANCELLED,
        (OrderState.PENDING_PAYMENT, OrderEventType.PAYMENT_SUCCESSFUL): OrderState.CONFIRMED,
        (OrderState.CONFIRMED, OrderEventType.PREPARING_SHIPMENT): OrderState.PROCESSING,
        (OrderState.PROCESSING, OrderEventType.ITEM_DISPATCHED): OrderState.SHIPPED,
        (OrderState.SHIPPED, OrderEventType.ITEM_RECEIVED_BY_CUSTOMER): OrderState.DELIVERED,
        (OrderState.SHIPPED, OrderEventType.DELIVERY_ISSUE): OrderState.ON_HOLD,
        (OrderState.DELIVERED, OrderEventType.RETURN_INITIATED_BY_CUSTOMER): OrderState.RETURNING,
        (OrderState.RETURNING, OrderEventType.ITEM_RECEIVED_BACK): OrderState.RETURNED,
        (OrderState.RETURNED, OrderEventType.REFUND_PROCESSED): OrderState.REFUNDED,
        (OrderState.PENDING, OrderEventType.ORDER_CANCELLED_BY_USER): OrderState.CANCELLED,
        (OrderState.PENDING_PAYMENT, OrderEventType.ORDER_CANCELLED_BY_USER): OrderState.CANCELLED,
        (OrderState.CONFIRMED, OrderEventType.ORDER_CANCELLED_BY_USER): OrderState.CANCELLED,
        (OrderState.PROCESSING, OrderEventType.ORDER_CANCELLED_BY_USER): OrderState.CANCELLED,
        (OrderState.SHIPPED, OrderEventType.ORDER_CANCELLED_BY_USER): OrderState.CANCELLED,
        (OrderState.ON_HOLD, OrderEventType.ORDER_CANCELLED_BY_USER): OrderState.CANCELLED,
        (OrderState.RETURNING, OrderEventType.ORDER_CANCELLED_BY_USER): OrderState.CANCELLED,
    }

    def get_next_state(
        self,
        current_state: OrderState,
        event_type: OrderEventType,
    ) -> OrderState:
        try:
            return self._transitions[(current_state, event_type)]
        except KeyError as error:
            raise InvalidOrderTransitionError(current_state, event_type) from error
