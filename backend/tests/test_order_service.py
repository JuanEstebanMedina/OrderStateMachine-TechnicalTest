from copy import deepcopy
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, create_autospec, patch
from uuid import UUID

import pytest

from app.domain import (
    InvalidOrderTransitionError,
    Order,
    OrderEventType,
    OrderNotFoundError,
    OrderState,
    SupportTicket,
)
from app.ports import OrderRepository, SupportTicketRepository
from app.services import OrderService, OrderStateMachine


def create_service() -> tuple[OrderService, Mock, Mock]:
    order_repository = create_autospec(OrderRepository, instance=True)
    support_ticket_repository = create_autospec(
        SupportTicketRepository,
        instance=True,
    )
    order_repository.save.side_effect = lambda order: order

    service = OrderService(
        order_repository=order_repository,
        support_ticket_repository=support_ticket_repository,
        state_machine=OrderStateMachine(),
    )

    return service, order_repository, support_ticket_repository


def test_create_order_uses_generated_uuid_and_saves_order() -> None:
    service, order_repository, _ = create_service()
    generated_uuid = UUID("11111111-1111-1111-1111-111111111111")
    saved_order = Order(
        id=str(generated_uuid),
        product_ids=["product-1"],
        amount=100.0,
    )
    order_repository.save.return_value = saved_order
    order_repository.save.side_effect = None

    with patch("app.services.order_service.uuid.uuid4", return_value=generated_uuid):
        result = service.create_order(product_ids=["product-1"], amount=100.0)

    order_repository.save.assert_called_once()
    created_order = order_repository.save.call_args.args[0]
    assert created_order.id == str(generated_uuid)
    assert created_order.current_state == OrderState.PENDING
    assert created_order.history == []
    assert result == saved_order


def test_get_order_returns_existing_order() -> None:
    service, order_repository, _ = create_service()
    order = Order(id="order-1", product_ids=["product-1"], amount=100.0)
    order_repository.get_by_id.return_value = order

    assert service.get_order("order-1") == order


def test_get_order_raises_when_order_does_not_exist() -> None:
    service, order_repository, _ = create_service()
    order_repository.get_by_id.return_value = None

    with pytest.raises(OrderNotFoundError):
        service.get_order("missing-order")


def test_list_orders_returns_repository_result() -> None:
    service, order_repository, _ = create_service()
    orders = [
        Order(id="order-1", product_ids=["product-1"], amount=100.0),
        Order(id="order-2", product_ids=["product-2"], amount=200.0),
    ]
    order_repository.list_all.return_value = orders

    assert service.list_orders() == orders


def test_apply_event_updates_state_appends_history_and_saves_order() -> None:
    service, order_repository, _ = create_service()
    created_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    order = Order(
        id="order-1",
        product_ids=["product-1"],
        amount=100.0,
        current_state=OrderState.PENDING_PAYMENT,
        created_at=created_at,
        updated_at=created_at,
    )
    metadata = {"paymentId": "payment-1"}
    order_repository.get_by_id.return_value = order

    result = service.apply_event(
        order_id="order-1",
        event_type=OrderEventType.PAYMENT_SUCCESSFUL,
        metadata=metadata,
    )

    assert result.current_state == OrderState.CONFIRMED
    assert len(result.history) == 1
    history_entry = result.history[0]
    assert history_entry.event_type == OrderEventType.PAYMENT_SUCCESSFUL
    assert history_entry.from_state == OrderState.PENDING_PAYMENT
    assert history_entry.to_state == OrderState.CONFIRMED
    assert history_entry.metadata == metadata
    assert result.updated_at > created_at
    order_repository.save.assert_called_once_with(order)


def test_apply_event_uses_defensive_copy_for_history_metadata() -> None:
    service, order_repository, _ = create_service()
    order = Order(
        id="order-1",
        product_ids=["product-1"],
        amount=100.0,
        current_state=OrderState.PENDING_PAYMENT,
    )
    metadata = {"details": {"paymentId": "payment-1"}}
    order_repository.get_by_id.return_value = order

    result = service.apply_event(
        order_id="order-1",
        event_type=OrderEventType.PAYMENT_SUCCESSFUL,
        metadata=metadata,
    )
    metadata["details"]["paymentId"] = "changed"

    assert result.history[0].metadata == {"details": {"paymentId": "payment-1"}}


def test_invalid_transition_does_not_save_or_mutate_order() -> None:
    service, order_repository, support_ticket_repository = create_service()
    order = Order(
        id="order-1",
        product_ids=["product-1"],
        amount=1500.0,
        current_state=OrderState.PENDING_PAYMENT,
    )
    original_order = deepcopy(order)
    order_repository.get_by_id.return_value = order

    with pytest.raises(InvalidOrderTransitionError):
        service.apply_event(
            order_id="order-1",
            event_type=OrderEventType.ITEM_DISPATCHED,
            metadata={"carrier": "local"},
        )

    order_repository.save.assert_not_called()
    support_ticket_repository.save.assert_not_called()
    assert order == original_order


def test_apply_event_to_missing_order_does_not_save() -> None:
    service, order_repository, support_ticket_repository = create_service()
    order_repository.get_by_id.return_value = None

    with pytest.raises(OrderNotFoundError):
        service.apply_event(
            order_id="missing-order",
            event_type=OrderEventType.PAYMENT_SUCCESSFUL,
        )

    order_repository.save.assert_not_called()
    support_ticket_repository.save.assert_not_called()


def test_valid_high_value_payment_failure_creates_support_ticket() -> None:
    service, order_repository, support_ticket_repository = create_service()
    order = Order(
        id="order-1",
        product_ids=["product-1"],
        amount=1000.01,
        current_state=OrderState.PENDING,
    )
    metadata = {"provider": "payment-gateway"}
    order_repository.get_by_id.return_value = order
    generated_uuid = UUID("22222222-2222-2222-2222-222222222222")

    with patch("app.services.order_service.uuid.uuid4", return_value=generated_uuid):
        service.apply_event(
            order_id="order-1",
            event_type=OrderEventType.PAYMENT_FAILED,
            metadata=metadata,
        )

    support_ticket_repository.save.assert_called_once()
    ticket = support_ticket_repository.save.call_args.args[0]
    assert isinstance(ticket, SupportTicket)
    assert ticket.id == str(generated_uuid)
    assert ticket.order_id == "order-1"
    assert ticket.reason == "High-value order payment failed"
    assert ticket.metadata == {
        "order_amount": 1000.01,
        "event_metadata": metadata,
    }


@pytest.mark.parametrize("amount", [1000.0, 999.99])
def test_payment_failure_for_amount_up_to_1000_does_not_create_ticket(
    amount: float,
) -> None:
    service, order_repository, support_ticket_repository = create_service()
    order = Order(
        id="order-1",
        product_ids=["product-1"],
        amount=amount,
        current_state=OrderState.PENDING,
    )
    order_repository.get_by_id.return_value = order

    service.apply_event(
        order_id="order-1",
        event_type=OrderEventType.PAYMENT_FAILED,
        metadata={"provider": "payment-gateway"},
    )

    support_ticket_repository.save.assert_not_called()


def test_invalid_payment_failure_does_not_create_support_ticket() -> None:
    service, order_repository, support_ticket_repository = create_service()
    order = Order(
        id="order-1",
        product_ids=["product-1"],
        amount=1500.0,
        current_state=OrderState.CONFIRMED,
    )
    order_repository.get_by_id.return_value = order

    with pytest.raises(InvalidOrderTransitionError):
        service.apply_event(
            order_id="order-1",
            event_type=OrderEventType.PAYMENT_FAILED,
        )

    order_repository.save.assert_not_called()
    support_ticket_repository.save.assert_not_called()
