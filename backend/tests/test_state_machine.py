import pytest

from app.domain import InvalidOrderTransitionError, OrderEventType, OrderState
from app.services import OrderStateMachine


def test_pending_without_verification_goes_to_pending_payment() -> None:
    state_machine = OrderStateMachine()

    next_state = state_machine.get_next_state(
        OrderState.PENDING,
        OrderEventType.NO_VERIFICATION_NEEDED,
    )

    assert next_state == OrderState.PENDING_PAYMENT


def test_pending_with_biometrical_verification_goes_to_on_hold() -> None:
    state_machine = OrderStateMachine()

    next_state = state_machine.get_next_state(
        OrderState.PENDING,
        OrderEventType.PENDING_BIOMETRICAL_VERIFICATION,
    )

    assert next_state == OrderState.ON_HOLD


def test_pending_payment_with_successful_payment_goes_to_confirmed() -> None:
    state_machine = OrderStateMachine()

    next_state = state_machine.get_next_state(
        OrderState.PENDING_PAYMENT,
        OrderEventType.PAYMENT_SUCCESSFUL,
    )

    assert next_state == OrderState.CONFIRMED


def test_processing_with_item_dispatched_goes_to_shipped() -> None:
    state_machine = OrderStateMachine()

    next_state = state_machine.get_next_state(
        OrderState.PROCESSING,
        OrderEventType.ITEM_DISPATCHED,
    )

    assert next_state == OrderState.SHIPPED


def test_shipped_with_delivery_issue_goes_to_on_hold() -> None:
    state_machine = OrderStateMachine()

    next_state = state_machine.get_next_state(
        OrderState.SHIPPED,
        OrderEventType.DELIVERY_ISSUE,
    )

    assert next_state == OrderState.ON_HOLD


def test_delivered_with_return_initiated_goes_to_returning() -> None:
    state_machine = OrderStateMachine()

    next_state = state_machine.get_next_state(
        OrderState.DELIVERED,
        OrderEventType.RETURN_INITIATED_BY_CUSTOMER,
    )

    assert next_state == OrderState.RETURNING


def test_returning_with_item_received_back_goes_to_returned() -> None:
    state_machine = OrderStateMachine()

    next_state = state_machine.get_next_state(
        OrderState.RETURNING,
        OrderEventType.ITEM_RECEIVED_BACK,
    )

    assert next_state == OrderState.RETURNED


def test_returned_with_refund_processed_goes_to_refunded() -> None:
    state_machine = OrderStateMachine()

    next_state = state_machine.get_next_state(
        OrderState.RETURNED,
        OrderEventType.REFUND_PROCESSED,
    )

    assert next_state == OrderState.REFUNDED


def test_active_order_can_be_cancelled_by_user() -> None:
    state_machine = OrderStateMachine()

    next_state = state_machine.get_next_state(
        OrderState.PROCESSING,
        OrderEventType.ORDER_CANCELLED_BY_USER,
    )

    assert next_state == OrderState.CANCELLED


def test_on_hold_order_can_be_cancelled_by_user() -> None:
    state_machine = OrderStateMachine()

    next_state = state_machine.get_next_state(
        OrderState.ON_HOLD,
        OrderEventType.ORDER_CANCELLED_BY_USER,
    )

    assert next_state == OrderState.CANCELLED


def test_delivered_order_cannot_be_cancelled_by_user() -> None:
    state_machine = OrderStateMachine()

    with pytest.raises(InvalidOrderTransitionError):
        state_machine.get_next_state(
            OrderState.DELIVERED,
            OrderEventType.ORDER_CANCELLED_BY_USER,
        )


def test_returned_order_cannot_be_cancelled_by_user() -> None:
    state_machine = OrderStateMachine()

    with pytest.raises(InvalidOrderTransitionError):
        state_machine.get_next_state(
            OrderState.RETURNED,
            OrderEventType.ORDER_CANCELLED_BY_USER,
        )


def test_refunded_order_cannot_be_cancelled_by_user() -> None:
    state_machine = OrderStateMachine()

    with pytest.raises(InvalidOrderTransitionError):
        state_machine.get_next_state(
            OrderState.REFUNDED,
            OrderEventType.ORDER_CANCELLED_BY_USER,
        )


def test_cancelled_order_cannot_be_cancelled_by_user() -> None:
    state_machine = OrderStateMachine()

    with pytest.raises(InvalidOrderTransitionError):
        state_machine.get_next_state(
            OrderState.CANCELLED,
            OrderEventType.ORDER_CANCELLED_BY_USER,
        )


def test_pending_payment_cannot_dispatch_item() -> None:
    state_machine = OrderStateMachine()

    with pytest.raises(InvalidOrderTransitionError):
        state_machine.get_next_state(
            OrderState.PENDING_PAYMENT,
            OrderEventType.ITEM_DISPATCHED,
        )


@pytest.mark.parametrize(
    ("state", "expected_events"),
    [
        (
            OrderState.PENDING,
            [
                OrderEventType.PENDING_BIOMETRICAL_VERIFICATION,
                OrderEventType.NO_VERIFICATION_NEEDED,
                OrderEventType.PAYMENT_FAILED,
                OrderEventType.ORDER_CANCELLED,
                OrderEventType.ORDER_CANCELLED_BY_USER,
            ],
        ),
        (
            OrderState.ON_HOLD,
            [
                OrderEventType.BIOMETRICAL_VERIFICATION_SUCCESSFUL,
                OrderEventType.VERIFICATION_FAILED,
                OrderEventType.ORDER_CANCELLED_BY_USER,
            ],
        ),
        (
            OrderState.SHIPPED,
            [
                OrderEventType.ORDER_CANCELLED_BY_USER,
                OrderEventType.ITEM_RECEIVED_BY_CUSTOMER,
                OrderEventType.DELIVERY_ISSUE,
            ],
        ),
        (
            OrderState.DELIVERED,
            [OrderEventType.RETURN_INITIATED_BY_CUSTOMER],
        ),
        (OrderState.REFUNDED, []),
        (OrderState.CANCELLED, []),
    ],
)
def test_get_available_events_returns_real_user_events_for_state(
    state: OrderState,
    expected_events: list[OrderEventType],
) -> None:
    state_machine = OrderStateMachine()

    available_events = state_machine.get_available_events(state)

    assert available_events == expected_events
    assert OrderEventType.INIT not in available_events


def test_get_available_events_returns_a_new_list() -> None:
    state_machine = OrderStateMachine()

    first_result = state_machine.get_available_events(OrderState.PENDING)
    second_result = state_machine.get_available_events(OrderState.PENDING)

    assert first_result is not second_result


def test_transition_definitions_are_derived_from_real_transitions() -> None:
    state_machine = OrderStateMachine()

    transitions = state_machine.get_transition_definitions()

    assert any(
        transition.from_state == OrderState.PENDING
        and transition.event_type == OrderEventType.NO_VERIFICATION_NEEDED
        and transition.to_state == OrderState.PENDING_PAYMENT
        for transition in transitions
    )
    assert any(
        transition.from_state == OrderState.SHIPPED
        and transition.event_type == OrderEventType.ORDER_CANCELLED_BY_USER
        and transition.to_state == OrderState.CANCELLED
        for transition in transitions
    )
    assert not any(
        transition.event_type == OrderEventType.INIT for transition in transitions
    )
