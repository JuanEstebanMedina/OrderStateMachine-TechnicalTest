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


def test_delivered_order_cannot_be_cancelled_by_user() -> None:
    state_machine = OrderStateMachine()

    with pytest.raises(InvalidOrderTransitionError):
        state_machine.get_next_state(
            OrderState.DELIVERED,
            OrderEventType.ORDER_CANCELLED_BY_USER,
        )


def test_pending_payment_cannot_dispatch_item() -> None:
    state_machine = OrderStateMachine()

    with pytest.raises(InvalidOrderTransitionError):
        state_machine.get_next_state(
            OrderState.PENDING_PAYMENT,
            OrderEventType.ITEM_DISPATCHED,
        )
