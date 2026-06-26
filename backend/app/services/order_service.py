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
    RuleContext,
    RuleEngineResult,
    SupportTicketDraft,
    SupportTicket,
)
from app.ports import OrderRepository
from app.services.rule_engine import RuleEngine
from app.services.state_machine import OrderStateMachine


MULTIPLE_SUPPORT_REVIEWS_REASON = "Multiple rule-based support reviews required"


class OrderService:
    def __init__(
        self,
        order_repository: OrderRepository,
        state_machine: OrderStateMachine,
        rule_engine: RuleEngine,
    ) -> None:
        self._order_repository = order_repository
        self._state_machine = state_machine
        self._rule_engine = rule_engine

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
        proposed_state = self._state_machine.get_next_state(from_state, event_type)
        rule_result = self._rule_engine.evaluate(
            RuleContext(
                order=order,
                event_type=event_type,
                event_metadata=deepcopy(event_metadata),
                from_state=from_state,
                proposed_state=proposed_state,
            )
        )
        to_state = rule_result.final_state_override or proposed_state
        final_amount = self._calculate_final_amount(order.amount, rule_result)
        timestamp = self._utc_now()
        persisted_metadata = self._build_event_metadata(
            event_metadata=event_metadata,
            proposed_state=proposed_state,
            final_state=to_state,
            rule_result=rule_result,
        )

        # Validate the transition before constructing persistence records, then
        # hand the order update, event, and optional side effect to one atomic
        # repository operation.
        event_log = OrderEventLog(
            id=uuid.uuid4(),
            event_type=event_type,
            from_state=from_state,
            to_state=to_state,
            metadata=persisted_metadata,
            created_at=timestamp,
        )
        updated_order = Order(
            id=order.id,
            product_ids=deepcopy(order.product_ids),
            amount=final_amount,
            current_state=to_state,
            history=[*deepcopy(order.history), deepcopy(event_log)],
            created_at=order.created_at,
            updated_at=timestamp,
            version=expected_version + 1,
        )
        support_ticket = self._materialize_support_ticket(
            order=updated_order,
            drafts=rule_result.support_ticket_drafts,
            metadata=event_metadata,
            created_at=timestamp,
        )

        return self._order_repository.commit_transition(
            order=updated_order,
            event_log=event_log,
            support_ticket=support_ticket,
            expected_version=expected_version,
        )

    def _calculate_final_amount(
        self,
        base_amount: float,
        rule_result: RuleEngineResult,
    ) -> float:
        # All tax percentages use the original amount so action order cannot
        # influence monetary results.
        tax_amount = base_amount * rule_result.total_tax_percentage / 100
        return base_amount + tax_amount + rule_result.total_fixed_cost

    def _build_event_metadata(
        self,
        event_metadata: dict[str, Any],
        proposed_state: OrderState,
        final_state: OrderState,
        rule_result: RuleEngineResult,
    ) -> dict[str, Any]:
        persisted_metadata = deepcopy(event_metadata)
        if rule_result.final_state_override is None:
            return persisted_metadata

        persisted_metadata["rule_state_override"] = {
            "proposed_state": proposed_state.value,
            "final_state": final_state.value,
            "matched_rule_ids": [*rule_result.final_state_override_rule_ids],
        }
        return persisted_metadata

    def _materialize_support_ticket(
        self,
        order: Order,
        drafts: tuple[SupportTicketDraft, ...],
        metadata: dict[str, Any],
        created_at: datetime,
    ) -> SupportTicket | None:
        if not drafts:
            return None

        reason = drafts[0].reason
        ticket_metadata: dict[str, Any] = {
            "order_amount": order.amount,
            "event_metadata": deepcopy(metadata),
        }

        if len(drafts) > 1:
            # One repository-side ticket aggregates multiple rule drafts for
            # this MVP's existing atomic persistence contract.
            reason = MULTIPLE_SUPPORT_REVIEWS_REASON
            ticket_metadata["reasons"] = self._deduplicate(
                [draft.reason for draft in drafts]
            )
            ticket_metadata["matched_rule_ids"] = self._deduplicate(
                [draft.source_rule_id for draft in drafts]
            )

        return SupportTicket(
            id=uuid.uuid4(),
            order_id=order.id,
            reason=reason,
            metadata=ticket_metadata,
            created_at=created_at,
        )

    def _deduplicate(self, values: list[str]) -> list[str]:
        unique_values: list[str] = []
        for value in values:
            if value not in unique_values:
                unique_values.append(value)
        return unique_values

    def _utc_now(self) -> datetime:
        return datetime.now(timezone.utc)
