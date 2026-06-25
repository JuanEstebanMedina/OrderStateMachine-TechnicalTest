from typing import Any
from uuid import UUID

import pytest

from app.domain import (
    AddFixedCostParameters,
    AddTaxParameters,
    ComparisonOperator,
    ConditionNode,
    CreateSupportTicketParameters,
    GroupNode,
    LogicalOperator,
    Order,
    OrderEventType,
    OrderRule,
    OrderState,
    RuleAction,
    RuleActionType,
    RuleConfigurationError,
    RuleContext,
    RuleField,
    RuleIndexKey,
    RuleStateOverrideConflictError,
    SetFinalStateParameters,
)
from app.ports import RuleRepository
from app.services import RuleEngine, RuleEvaluator


ORDER_ID = UUID("11111111-1111-1111-1111-111111111111")


class FakeRuleRepository(RuleRepository):
    def __init__(self, rules: list[OrderRule]) -> None:
        self._rules = rules

    def list_enabled(self) -> list[OrderRule]:
        return [rule for rule in self._rules if rule.enabled]


def context(
    amount: float = 1200.0,
    metadata: dict[str, Any] | None = None,
) -> RuleContext:
    return RuleContext(
        order=Order(
            id=ORDER_ID,
            product_ids=["product-1", "product-2"],
            amount=amount,
            current_state=OrderState.PENDING_PAYMENT,
        ),
        event_type=OrderEventType.PAYMENT_SUCCESSFUL,
        event_metadata=metadata or {},
        from_state=OrderState.PENDING_PAYMENT,
        proposed_state=OrderState.CONFIRMED,
    )


def condition(
    field: RuleField,
    operator: ComparisonOperator,
    value: Any,
) -> ConditionNode:
    return ConditionNode(field=field, operator=operator, value=value)


def action(
    action_type: RuleActionType = RuleActionType.ADD_TAX,
    parameters: Any | None = None,
) -> RuleAction:
    if parameters is None:
        parameters = AddTaxParameters(percentage=10)
    return RuleAction(action_type=action_type, parameters=parameters)


def rule(
    rule_id: str,
    event_type: OrderEventType = OrderEventType.PAYMENT_SUCCESSFUL,
    from_states: tuple[OrderState, ...] = (OrderState.PENDING_PAYMENT,),
    node: ConditionNode | GroupNode | None = None,
    actions: tuple[RuleAction, ...] | None = None,
    enabled: bool = True,
) -> OrderRule:
    return OrderRule(
        id=rule_id,
        name=rule_id,
        enabled=enabled,
        event_type=event_type,
        from_states=from_states,
        condition=node
        or condition(RuleField.AMOUNT, ComparisonOperator.GREATER_THAN, 0),
        actions=actions or (action(),),
    )


@pytest.mark.parametrize(
    ("node", "metadata", "expected"),
    [
        (
            condition(RuleField.DESTINATION_COUNTRY, ComparisonOperator.EQUALS, "US"),
            {"destinationCountry": "US"},
            True,
        ),
        (
            condition(RuleField.DESTINATION_COUNTRY, ComparisonOperator.NOT_EQUALS, "CA"),
            {"destinationCountry": "US"},
            True,
        ),
        (
            condition(RuleField.AMOUNT, ComparisonOperator.GREATER_THAN, 1000),
            {},
            True,
        ),
        (
            condition(RuleField.AMOUNT, ComparisonOperator.LESS_THAN, 1500),
            {},
            True,
        ),
        (
            condition(RuleField.EVENT_TYPE, ComparisonOperator.IN, ("paymentSuccessful",)),
            {},
            True,
        ),
    ],
)
def test_evaluator_supports_comparison_operators(
    node: ConditionNode,
    metadata: dict[str, Any],
    expected: bool,
) -> None:
    assert RuleEvaluator().evaluate(node, context(metadata=metadata)) is expected


def test_evaluator_supports_nested_and_or() -> None:
    node = GroupNode(
        operator=LogicalOperator.OR,
        children=(
            condition(RuleField.DESTINATION_COUNTRY, ComparisonOperator.EQUALS, "CA"),
            GroupNode(
                operator=LogicalOperator.AND,
                children=(
                    condition(RuleField.AMOUNT, ComparisonOperator.GREATER_THAN, 1000),
                    condition(
                        RuleField.MANUAL_REVIEW_REQUIRED,
                        ComparisonOperator.EQUALS,
                        True,
                    ),
                ),
            ),
        ),
    )

    assert RuleEvaluator().evaluate(
        node,
        context(metadata={"manualReviewRequired": True}),
    )


def test_missing_metadata_evaluates_false_for_equals_and_not_equals() -> None:
    evaluator = RuleEvaluator()

    assert not evaluator.evaluate(
        condition(RuleField.DESTINATION_COUNTRY, ComparisonOperator.EQUALS, "US"),
        context(),
    )
    assert not evaluator.evaluate(
        condition(RuleField.DESTINATION_COUNTRY, ComparisonOperator.NOT_EQUALS, "US"),
        context(),
    )


def test_and_short_circuits_after_false_condition() -> None:
    def fail_if_called(_context: RuleContext) -> Any:
        raise AssertionError("resolver should not be called")

    evaluator = RuleEvaluator({RuleField.DESTINATION_COUNTRY: fail_if_called})
    node = GroupNode(
        operator=LogicalOperator.AND,
        children=(
            condition(RuleField.AMOUNT, ComparisonOperator.GREATER_THAN, 5000),
            condition(RuleField.DESTINATION_COUNTRY, ComparisonOperator.EQUALS, "US"),
        ),
    )

    assert not evaluator.evaluate(node, context())


def test_or_short_circuits_after_true_condition() -> None:
    def fail_if_called(_context: RuleContext) -> Any:
        raise AssertionError("resolver should not be called")

    evaluator = RuleEvaluator({RuleField.DESTINATION_COUNTRY: fail_if_called})
    node = GroupNode(
        operator=LogicalOperator.OR,
        children=(
            condition(RuleField.AMOUNT, ComparisonOperator.GREATER_THAN, 1000),
            condition(RuleField.DESTINATION_COUNTRY, ComparisonOperator.EQUALS, "US"),
        ),
    )

    assert evaluator.evaluate(node, context())


def test_engine_indexes_rules_by_event_and_source_state() -> None:
    matching_rule = rule("matching")
    other_event_rule = rule(
        "other-event",
        event_type=OrderEventType.PAYMENT_FAILED,
    )
    other_state_rule = rule(
        "other-state",
        from_states=(OrderState.PENDING,),
    )
    engine = RuleEngine(
        FakeRuleRepository([matching_rule, other_event_rule, other_state_rule])
    )

    result = engine.evaluate(context())

    assert result.matched_rule_ids == ("matching",)


def test_rule_with_multiple_source_states_is_indexed_for_each_state() -> None:
    indexed_rule = rule(
        "multi-state",
        from_states=(OrderState.PENDING_PAYMENT, OrderState.PENDING),
    )
    engine = RuleEngine(FakeRuleRepository([indexed_rule]))

    assert engine.get_indexed_rules(
        RuleIndexKey(OrderEventType.PAYMENT_SUCCESSFUL, OrderState.PENDING_PAYMENT)
    ) == (indexed_rule,)
    assert engine.get_indexed_rules(
        RuleIndexKey(OrderEventType.PAYMENT_SUCCESSFUL, OrderState.PENDING)
    ) == (indexed_rule,)


def test_disabled_rules_are_not_indexed() -> None:
    disabled_rule = rule("disabled", enabled=False)
    engine = RuleEngine(FakeRuleRepository([disabled_rule]))

    assert engine.evaluate(context()).matched_rule_ids == ()


def test_action_handlers_aggregate_effects() -> None:
    engine = RuleEngine(
        FakeRuleRepository(
            [
                rule(
                    "effects",
                    actions=(
                        action(RuleActionType.ADD_TAX, AddTaxParameters(percentage=10)),
                        action(RuleActionType.ADD_TAX, AddTaxParameters(percentage=5)),
                        action(
                            RuleActionType.ADD_FIXED_COST,
                            AddFixedCostParameters(amount=25),
                        ),
                        action(
                            RuleActionType.CREATE_SUPPORT_TICKET,
                            CreateSupportTicketParameters(reason="Review order"),
                        ),
                        action(
                            RuleActionType.SET_FINAL_STATE,
                            SetFinalStateParameters(state=OrderState.ON_HOLD),
                        ),
                    ),
                )
            ]
        )
    )

    result = engine.evaluate(context())

    assert result.total_tax_percentage == pytest.approx(15)
    assert result.total_fixed_cost == pytest.approx(25)
    assert result.support_ticket_drafts[0].source_rule_id == "effects"
    assert result.support_ticket_drafts[0].reason == "Review order"
    assert result.final_state_override == OrderState.ON_HOLD
    assert result.final_state_override_rule_ids == ("effects",)


def test_duplicate_equal_overrides_collapse_to_one_state() -> None:
    engine = RuleEngine(
        FakeRuleRepository(
            [
                rule(
                    "override-a",
                    actions=(
                        action(
                            RuleActionType.SET_FINAL_STATE,
                            SetFinalStateParameters(state=OrderState.ON_HOLD),
                        ),
                    ),
                ),
                rule(
                    "override-b",
                    actions=(
                        action(
                            RuleActionType.SET_FINAL_STATE,
                            SetFinalStateParameters(state=OrderState.ON_HOLD),
                        ),
                    ),
                ),
            ]
        )
    )

    result = engine.evaluate(context())

    assert result.final_state_override == OrderState.ON_HOLD
    assert result.final_state_override_rule_ids == ("override-a", "override-b")


def test_conflicting_override_targets_raise_domain_error() -> None:
    engine = RuleEngine(
        FakeRuleRepository(
            [
                rule(
                    "override-a",
                    actions=(
                        action(
                            RuleActionType.SET_FINAL_STATE,
                            SetFinalStateParameters(state=OrderState.ON_HOLD),
                        ),
                    ),
                ),
                rule(
                    "override-b",
                    actions=(
                        action(
                            RuleActionType.SET_FINAL_STATE,
                            SetFinalStateParameters(state=OrderState.CANCELLED),
                        ),
                    ),
                ),
            ]
        )
    )

    with pytest.raises(RuleStateOverrideConflictError):
        engine.evaluate(context())


def test_missing_action_handler_is_configuration_error() -> None:
    engine = RuleEngine(
        FakeRuleRepository([rule("matching")]),
        action_handlers={},
    )

    with pytest.raises(RuleConfigurationError):
        engine.evaluate(context())
