from collections.abc import Callable, Mapping
import math
from typing import Any

from app.domain import (
    ComparisonOperator,
    ConditionNode,
    GroupNode,
    LogicalOperator,
    OrderRule,
    OrderState,
    RuleActionEffect,
    RuleActionType,
    RuleConfigurationError,
    RuleContext,
    RuleEngineResult,
    RuleField,
    RuleIndexKey,
    RuleNode,
    RuleStateOverrideConflictError,
    SupportTicketDraft,
)
from app.ports import RuleRepository
from app.services.rule_actions import ActionHandler, build_default_action_handlers


_MISSING = object()


class RuleEvaluator:
    """Pure evaluator for explicit condition trees and field resolvers."""

    def __init__(
        self,
        field_resolvers: Mapping[RuleField, Callable[[RuleContext], Any]] | None = None,
    ) -> None:
        self._field_resolvers = _default_field_resolvers()
        if field_resolvers is not None:
            self._field_resolvers.update(field_resolvers)

    def evaluate(self, node: RuleNode, context: RuleContext) -> bool:
        if isinstance(node, ConditionNode):
            return self._evaluate_condition(node, context)

        if node.operator == LogicalOperator.AND:
            return all(self.evaluate(child, context) for child in node.children)

        return any(self.evaluate(child, context) for child in node.children)

    def _evaluate_condition(self, node: ConditionNode, context: RuleContext) -> bool:
        actual_value = self._field_resolvers[node.field](context)
        # Missing metadata is always false, including NOT_EQUALS, to avoid
        # accidentally matching rules from absent user-provided data.
        if actual_value is _MISSING:
            return False

        if node.operator == ComparisonOperator.EQUALS:
            return actual_value == node.value

        if node.operator == ComparisonOperator.NOT_EQUALS:
            return actual_value != node.value

        if node.operator == ComparisonOperator.GREATER_THAN:
            return _is_finite_number(actual_value) and actual_value > node.value

        if node.operator == ComparisonOperator.LESS_THAN:
            return _is_finite_number(actual_value) and actual_value < node.value

        return actual_value in node.value


class RuleEngine:
    """Evaluates only rules indexed by order event and current source state.

    The state machine must validate the lifecycle transition before this engine
    receives a context. A final-state override is therefore a post-validation
    policy decision, not a way to make invalid events valid.
    """

    def __init__(
        self,
        rule_repository: RuleRepository,
        evaluator: RuleEvaluator | None = None,
        action_handlers: Mapping[RuleActionType, ActionHandler] | None = None,
    ) -> None:
        self._evaluator = evaluator or RuleEvaluator()
        self._action_handlers = dict(
            build_default_action_handlers()
            if action_handlers is None
            else action_handlers
        )
        self._index = self._build_index(tuple(rule_repository.list_enabled()))

    def evaluate(self, context: RuleContext) -> RuleEngineResult:
        rules = self._index.get(
            RuleIndexKey(
                event_type=context.event_type,
                from_state=context.from_state,
            ),
            (),
        )
        matched_rule_ids: list[str] = []
        total_tax_percentage = 0.0
        total_fixed_cost = 0.0
        support_ticket_drafts: list[SupportTicketDraft] = []
        final_state_overrides: list[OrderState] = []
        final_state_override_rule_ids: list[str] = []

        for rule in rules:
            if not self._evaluator.evaluate(rule.condition, context):
                continue

            matched_rule_ids.append(rule.id)
            for action in rule.actions:
                effect = self._handle_action(rule, action.action_type, action, context)
                total_tax_percentage += effect.tax_percentage
                total_fixed_cost += effect.fixed_cost

                if effect.support_ticket_draft is not None:
                    support_ticket_drafts.append(effect.support_ticket_draft)

                if effect.final_state_override is not None:
                    final_state_overrides.append(effect.final_state_override)
                    final_state_override_rule_ids.append(rule.id)

        return RuleEngineResult(
            matched_rule_ids=tuple(matched_rule_ids),
            total_tax_percentage=total_tax_percentage,
            total_fixed_cost=total_fixed_cost,
            support_ticket_drafts=tuple(support_ticket_drafts),
            final_state_override=self._resolve_final_state_override(
                final_state_overrides
            ),
            final_state_override_rule_ids=tuple(
                _deduplicate(final_state_override_rule_ids)
            ),
        )

    def get_indexed_rules(self, key: RuleIndexKey) -> tuple[OrderRule, ...]:
        return self._index.get(key, ())

    def _build_index(
        self,
        rules: tuple[OrderRule, ...],
    ) -> dict[RuleIndexKey, tuple[OrderRule, ...]]:
        index: dict[RuleIndexKey, list[OrderRule]] = {}
        for rule in rules:
            for from_state in rule.from_states:
                key = RuleIndexKey(event_type=rule.event_type, from_state=from_state)
                index.setdefault(key, []).append(rule)

        return {key: tuple(indexed_rules) for key, indexed_rules in index.items()}

    def _handle_action(
        self,
        rule: OrderRule,
        action_type: RuleActionType,
        action: Any,
        context: RuleContext,
    ) -> RuleActionEffect:
        handler = self._action_handlers.get(action_type)
        if handler is None:
            raise RuleConfigurationError(
                f"No action handler registered for {action_type.value}"
            )

        return handler.handle(rule, action, context)

    def _resolve_final_state_override(
        self,
        overrides: list[OrderState],
    ) -> OrderState | None:
        unique_overrides = tuple(_deduplicate(overrides))
        if not unique_overrides:
            return None

        if len(unique_overrides) == 1:
            return unique_overrides[0]

        # Conflicting overrides fail instead of depending on JSON rule order.
        raise RuleStateOverrideConflictError(unique_overrides)


def _default_field_resolvers() -> dict[RuleField, Callable[[RuleContext], Any]]:
    return {
        RuleField.AMOUNT: lambda context: context.order.amount,
        RuleField.PRODUCT_COUNT: lambda context: len(context.order.product_ids),
        RuleField.CURRENT_STATE: lambda context: context.from_state.value,
        RuleField.PROPOSED_STATE: lambda context: context.proposed_state.value,
        RuleField.EVENT_TYPE: lambda context: context.event_type.value,
        RuleField.ORIGIN_COUNTRY: _metadata_resolver("originCountry"),
        RuleField.DESTINATION_COUNTRY: _metadata_resolver("destinationCountry"),
        RuleField.MANUAL_REVIEW_REQUIRED: _metadata_resolver("manualReviewRequired"),
    }


def _metadata_resolver(key: str) -> Callable[[RuleContext], Any]:
    return lambda context: context.event_metadata.get(key, _MISSING)


def _is_finite_number(value: Any) -> bool:
    return (
        isinstance(value, int | float)
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def _deduplicate[T](items: list[T]) -> list[T]:
    unique: list[T] = []
    for item in items:
        if item not in unique:
            unique.append(item)
    return unique
