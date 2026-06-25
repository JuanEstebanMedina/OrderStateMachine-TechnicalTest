from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any, cast
from unittest.mock import Mock, create_autospec, patch
from uuid import UUID

import pytest

from app.domain import (
    InvalidOrderTransitionError,
    Order,
    OrderEventType,
    OrderNotFoundError,
    RuleEngineResult,
    RuleStateOverrideConflictError,
    OrderState,
    OrderSummary,
    SupportTicketDraft,
    SupportTicket,
)
from app.ports import OrderRepository
from app.services import OrderService, OrderStateMachine, RuleEngine
from rule_test_utils import create_default_rule_engine


ORDER_ID = UUID("11111111-1111-1111-1111-111111111111")
SECOND_ORDER_ID = UUID("11111111-1111-1111-1111-111111111112")
MISSING_ORDER_ID = UUID("11111111-1111-1111-1111-111111111199")
GENERATED_ORDER_ID = UUID("33333333-3333-3333-3333-333333333333")
GENERATED_EVENT_ID = UUID("44444444-4444-4444-4444-444444444444")
GENERATED_TICKET_ID = UUID("55555555-5555-5555-5555-555555555555")


def create_service(rule_engine: RuleEngine | None = None) -> tuple[OrderService, Mock]:
    order_repository = create_autospec(OrderRepository, instance=True)
    order_repository.commit_transition.side_effect = lambda **kwargs: kwargs["order"]

    service = OrderService(
        order_repository=order_repository,
        state_machine=OrderStateMachine(),
        rule_engine=rule_engine or create_default_rule_engine(),
    )

    return service, order_repository


class FakeRuleEngine:
    def __init__(
        self,
        result: RuleEngineResult | None = None,
        error: Exception | None = None,
    ) -> None:
        self.contexts: list[Any] = []
        self._result = result or RuleEngineResult(
            matched_rule_ids=(),
            total_tax_percentage=0.0,
            total_fixed_cost=0.0,
            support_ticket_drafts=(),
            final_state_override=None,
        )
        self._error = error

    def evaluate(self, context: Any) -> RuleEngineResult:
        self.contexts.append(context)
        if self._error is not None:
            raise self._error
        return self._result


def test_create_order_uses_generated_uuid_and_creates_order() -> None:
    service, order_repository = create_service()
    saved_order = Order(
        id=GENERATED_ORDER_ID,
        product_ids=["product-1"],
        amount=100.0,
    )
    order_repository.create.return_value = saved_order

    with patch("app.services.order_service.uuid.uuid4", return_value=GENERATED_ORDER_ID):
        result = service.create_order(product_ids=["product-1"], amount=100.0)

    order_repository.create.assert_called_once()
    created_order = order_repository.create.call_args.args[0]
    assert isinstance(created_order.id, UUID)
    assert created_order.id == GENERATED_ORDER_ID
    assert created_order.current_state == OrderState.PENDING
    assert created_order.history == []
    assert created_order.version == 0
    assert result == saved_order


def test_get_order_returns_existing_order() -> None:
    service, order_repository = create_service()
    order = Order(id=ORDER_ID, product_ids=["product-1"], amount=100.0)
    order_repository.get_by_id.return_value = order

    assert service.get_order(ORDER_ID) == order


def test_get_order_raises_when_order_does_not_exist() -> None:
    service, order_repository = create_service()
    order_repository.get_by_id.return_value = None

    with pytest.raises(OrderNotFoundError):
        service.get_order(MISSING_ORDER_ID)


def test_list_orders_returns_repository_summaries() -> None:
    service, order_repository = create_service()
    created_at = datetime.now(timezone.utc)
    summaries = [
        OrderSummary(
            id=ORDER_ID,
            product_ids=["product-1"],
            amount=100.0,
            current_state=OrderState.PENDING,
            created_at=created_at,
            updated_at=created_at,
        ),
        OrderSummary(
            id=SECOND_ORDER_ID,
            product_ids=["product-2"],
            amount=200.0,
            current_state=OrderState.CONFIRMED,
            created_at=created_at,
            updated_at=created_at,
        ),
    ]
    order_repository.list_summaries.return_value = summaries

    assert service.list_orders() == summaries


def test_apply_event_builds_updated_order_and_commits_once() -> None:
    service, order_repository = create_service()
    created_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=100.0,
        current_state=OrderState.PENDING_PAYMENT,
        created_at=created_at,
        updated_at=created_at,
        version=3,
    )
    metadata = {"paymentId": "payment-1"}
    order_repository.get_by_id.return_value = order

    with patch("app.services.order_service.uuid.uuid4", return_value=GENERATED_EVENT_ID):
        result = service.apply_event(
            order_id=ORDER_ID,
            event_type=OrderEventType.PAYMENT_SUCCESSFUL,
            metadata=metadata,
        )

    order_repository.commit_transition.assert_called_once()
    call = order_repository.commit_transition.call_args.kwargs
    event_log = call["event_log"]
    committed_order = call["order"]

    assert call["expected_version"] == 3
    assert call["support_ticket"] is None
    assert event_log.id == GENERATED_EVENT_ID
    assert event_log.event_type == OrderEventType.PAYMENT_SUCCESSFUL
    assert event_log.from_state == OrderState.PENDING_PAYMENT
    assert event_log.to_state == OrderState.CONFIRMED
    assert event_log.metadata == metadata
    assert committed_order.current_state == OrderState.CONFIRMED
    assert committed_order.version == 4
    assert committed_order.updated_at > created_at
    assert committed_order.history == [event_log]
    assert result == committed_order


def test_apply_event_passes_rule_context_after_state_machine_proposal() -> None:
    fake_rule_engine = FakeRuleEngine()
    service, order_repository = create_service(cast(RuleEngine, fake_rule_engine))
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=100.0,
        current_state=OrderState.PENDING_PAYMENT,
    )
    metadata = {"details": {"paymentId": "payment-1"}}
    order_repository.get_by_id.return_value = order

    service.apply_event(
        order_id=ORDER_ID,
        event_type=OrderEventType.PAYMENT_SUCCESSFUL,
        metadata=metadata,
    )
    metadata["details"]["paymentId"] = "changed"

    assert len(fake_rule_engine.contexts) == 1
    context = fake_rule_engine.contexts[0]
    assert context.order == order
    assert context.event_type == OrderEventType.PAYMENT_SUCCESSFUL
    assert context.from_state == OrderState.PENDING_PAYMENT
    assert context.proposed_state == OrderState.CONFIRMED
    assert context.event_metadata == {"details": {"paymentId": "payment-1"}}


def test_apply_event_uses_one_timestamp_for_order_and_event() -> None:
    service, order_repository = create_service()
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=100.0,
        current_state=OrderState.PENDING_PAYMENT,
    )
    order_repository.get_by_id.return_value = order

    service.apply_event(
        order_id=ORDER_ID,
        event_type=OrderEventType.PAYMENT_SUCCESSFUL,
    )

    committed_order = order_repository.commit_transition.call_args.kwargs["order"]
    event_log = order_repository.commit_transition.call_args.kwargs["event_log"]
    assert committed_order.updated_at == event_log.created_at


def test_apply_event_uses_defensive_copy_for_history_metadata() -> None:
    service, order_repository = create_service()
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=100.0,
        current_state=OrderState.PENDING_PAYMENT,
    )
    metadata = {"details": {"paymentId": "payment-1"}}
    order_repository.get_by_id.return_value = order

    result = service.apply_event(
        order_id=ORDER_ID,
        event_type=OrderEventType.PAYMENT_SUCCESSFUL,
        metadata=metadata,
    )
    metadata["details"]["paymentId"] = "changed"

    assert result.history[0].metadata == {"details": {"paymentId": "payment-1"}}


def test_metadata_based_default_rule_does_not_match_when_metadata_is_absent() -> None:
    service, order_repository = create_service()
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=1200.0,
        current_state=OrderState.PENDING_PAYMENT,
    )
    order_repository.get_by_id.return_value = order

    result = service.apply_event(
        order_id=ORDER_ID,
        event_type=OrderEventType.PAYMENT_SUCCESSFUL,
    )

    assert result.amount == pytest.approx(1200.0)
    assert result.current_state == OrderState.CONFIRMED


def test_monetary_default_rule_updates_order_amount() -> None:
    service, order_repository = create_service()
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=1200.0,
        current_state=OrderState.PENDING_PAYMENT,
    )
    order_repository.get_by_id.return_value = order

    result = service.apply_event(
        order_id=ORDER_ID,
        event_type=OrderEventType.PAYMENT_SUCCESSFUL,
        metadata={"destinationCountry": "US"},
    )

    assert result.amount == pytest.approx(1345.0)
    assert result.current_state == OrderState.CONFIRMED


def test_final_state_override_updates_order_event_and_metadata() -> None:
    service, order_repository = create_service()
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=100.0,
        current_state=OrderState.PENDING_PAYMENT,
    )
    order_repository.get_by_id.return_value = order

    result = service.apply_event(
        order_id=ORDER_ID,
        event_type=OrderEventType.PAYMENT_SUCCESSFUL,
        metadata={"manualReviewRequired": True},
    )

    event_log = order_repository.commit_transition.call_args.kwargs["event_log"]
    assert result.current_state == OrderState.ON_HOLD
    assert event_log.to_state == OrderState.ON_HOLD
    assert event_log.metadata["rule_state_override"] == {
        "proposed_state": "Confirmed",
        "final_state": "OnHold",
        "matched_rule_ids": ["manual-review-payment-success"],
    }
    assert OrderStateMachine().get_next_state(
        OrderState.PENDING_PAYMENT,
        OrderEventType.PAYMENT_SUCCESSFUL,
    ) == OrderState.CONFIRMED


def test_invalid_transition_does_not_commit_or_mutate_order() -> None:
    service, order_repository = create_service()
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=1500.0,
        current_state=OrderState.PENDING_PAYMENT,
    )
    original_order = deepcopy(order)
    order_repository.get_by_id.return_value = order

    with pytest.raises(InvalidOrderTransitionError):
        service.apply_event(
            order_id=ORDER_ID,
            event_type=OrderEventType.ITEM_DISPATCHED,
            metadata={"carrier": "local"},
        )

    order_repository.commit_transition.assert_not_called()
    assert order == original_order


def test_invalid_transition_does_not_evaluate_rule_engine() -> None:
    fake_rule_engine = FakeRuleEngine()
    service, order_repository = create_service(cast(RuleEngine, fake_rule_engine))
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=1500.0,
        current_state=OrderState.CONFIRMED,
    )
    order_repository.get_by_id.return_value = order

    with pytest.raises(InvalidOrderTransitionError):
        service.apply_event(
            order_id=ORDER_ID,
            event_type=OrderEventType.PAYMENT_FAILED,
        )

    assert fake_rule_engine.contexts == []
    order_repository.commit_transition.assert_not_called()


def test_apply_event_to_missing_order_does_not_commit() -> None:
    service, order_repository = create_service()
    order_repository.get_by_id.return_value = None

    with pytest.raises(OrderNotFoundError):
        service.apply_event(
            order_id=MISSING_ORDER_ID,
            event_type=OrderEventType.PAYMENT_SUCCESSFUL,
        )

    order_repository.commit_transition.assert_not_called()


def test_valid_high_value_payment_failure_creates_support_ticket_in_commit() -> None:
    service, order_repository = create_service()
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=1000.01,
        current_state=OrderState.PENDING,
    )
    metadata = {"provider": "payment-gateway"}
    order_repository.get_by_id.return_value = order

    with patch(
        "app.services.order_service.uuid.uuid4",
        side_effect=[GENERATED_EVENT_ID, GENERATED_TICKET_ID],
    ):
        service.apply_event(
            order_id=ORDER_ID,
            event_type=OrderEventType.PAYMENT_FAILED,
            metadata=metadata,
        )

    ticket = order_repository.commit_transition.call_args.kwargs["support_ticket"]
    event_log = order_repository.commit_transition.call_args.kwargs["event_log"]
    assert isinstance(ticket, SupportTicket)
    assert ticket.id == GENERATED_TICKET_ID
    assert ticket.order_id == ORDER_ID
    assert ticket.reason == "High-value order payment failed"
    assert ticket.metadata == {
        "order_amount": 1000.01,
        "event_metadata": metadata,
    }
    assert ticket.created_at == event_log.created_at


def test_multiple_ticket_drafts_create_one_aggregated_ticket() -> None:
    fake_rule_engine = FakeRuleEngine(
        RuleEngineResult(
            matched_rule_ids=("rule-a", "rule-b"),
            total_tax_percentage=0.0,
            total_fixed_cost=25.0,
            support_ticket_drafts=(
                SupportTicketDraft("rule-a", "Review address"),
                SupportTicketDraft("rule-b", "Review address"),
                SupportTicketDraft("rule-b", "Review payment"),
            ),
            final_state_override=None,
        )
    )
    service, order_repository = create_service(cast(RuleEngine, fake_rule_engine))
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=100.0,
        current_state=OrderState.PENDING_PAYMENT,
    )
    order_repository.get_by_id.return_value = order

    with patch(
        "app.services.order_service.uuid.uuid4",
        side_effect=[GENERATED_EVENT_ID, GENERATED_TICKET_ID],
    ):
        service.apply_event(
            order_id=ORDER_ID,
            event_type=OrderEventType.PAYMENT_SUCCESSFUL,
            metadata={"source": "checkout"},
        )

    ticket = order_repository.commit_transition.call_args.kwargs["support_ticket"]
    assert isinstance(ticket, SupportTicket)
    assert ticket.reason == "Multiple rule-based support reviews required"
    assert ticket.metadata == {
        "order_amount": 125.0,
        "event_metadata": {"source": "checkout"},
        "reasons": ["Review address", "Review payment"],
        "matched_rule_ids": ["rule-a", "rule-b"],
    }


def test_conflicting_final_state_overrides_do_not_commit() -> None:
    fake_rule_engine = FakeRuleEngine(
        error=RuleStateOverrideConflictError(
            (OrderState.ON_HOLD, OrderState.CANCELLED)
        )
    )
    service, order_repository = create_service(cast(RuleEngine, fake_rule_engine))
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=100.0,
        current_state=OrderState.PENDING_PAYMENT,
    )
    order_repository.get_by_id.return_value = order

    with pytest.raises(RuleStateOverrideConflictError):
        service.apply_event(
            order_id=ORDER_ID,
            event_type=OrderEventType.PAYMENT_SUCCESSFUL,
        )

    order_repository.commit_transition.assert_not_called()


@pytest.mark.parametrize("amount", [1000.0, 999.99])
def test_payment_failure_for_amount_up_to_1000_does_not_create_ticket(
    amount: float,
) -> None:
    service, order_repository = create_service()
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=amount,
        current_state=OrderState.PENDING,
    )
    order_repository.get_by_id.return_value = order

    service.apply_event(
        order_id=ORDER_ID,
        event_type=OrderEventType.PAYMENT_FAILED,
        metadata={"provider": "payment-gateway"},
    )

    assert order_repository.commit_transition.call_args.kwargs["support_ticket"] is None


def test_invalid_payment_failure_does_not_create_support_ticket() -> None:
    service, order_repository = create_service()
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=1500.0,
        current_state=OrderState.CONFIRMED,
    )
    order_repository.get_by_id.return_value = order

    with pytest.raises(InvalidOrderTransitionError):
        service.apply_event(
            order_id=ORDER_ID,
            event_type=OrderEventType.PAYMENT_FAILED,
        )

    order_repository.commit_transition.assert_not_called()
