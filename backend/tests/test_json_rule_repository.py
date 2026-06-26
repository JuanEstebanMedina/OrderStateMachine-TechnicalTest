import json
from pathlib import Path

import pytest

from app.adapters import JsonRuleRepository
from app.domain import (
    AddTaxParameters,
    ConditionNode,
    GroupNode,
    OrderState,
    RuleActionType,
    RuleConfigurationError,
    SetFinalStateParameters,
)
from rule_test_utils import DEFAULT_RULES_PATH


def write_rules(tmp_path: Path, rules: list[dict]) -> Path:
    rules_path = tmp_path / "rules.json"
    rules_path.write_text(json.dumps({"rules": rules}), encoding="utf-8")
    return rules_path


def valid_rule(**overrides) -> dict:
    rule = {
        "id": "rule-1",
        "name": "Rule 1",
        "enabled": True,
        "eventType": "paymentSuccessful",
        "fromStates": ["PendingPayment"],
        "condition": {
            "type": "CONDITION",
            "field": "amount",
            "operator": "GREATER_THAN",
            "value": 100,
        },
        "actions": [
            {
                "type": "ADD_TAX",
                "parameters": {"percentage": 10},
            }
        ],
    }
    rule.update(overrides)
    return rule


def test_loads_default_rules() -> None:
    rules = JsonRuleRepository(DEFAULT_RULES_PATH).list_enabled()

    assert {rule.id for rule in rules} >= {
        "high-value-payment-failure",
        "us-high-value-payment-surcharge",
        "manual-review-payment-success",
    }


def test_parses_nested_and_or_groups(tmp_path: Path) -> None:
    rule = valid_rule(
        condition={
            "type": "GROUP",
            "operator": "OR",
            "children": [
                {
                    "type": "CONDITION",
                    "field": "destinationCountry",
                    "operator": "EQUALS",
                    "value": "US",
                },
                {
                    "type": "GROUP",
                    "operator": "AND",
                    "children": [
                        {
                            "type": "CONDITION",
                            "field": "amount",
                            "operator": "GREATER_THAN",
                            "value": 1000,
                        },
                        {
                            "type": "CONDITION",
                            "field": "productCount",
                            "operator": "LESS_THAN",
                            "value": 5,
                        },
                    ],
                },
            ],
        }
    )

    parsed_rule = JsonRuleRepository(write_rules(tmp_path, [rule])).list_enabled()[0]

    assert isinstance(parsed_rule.condition, GroupNode)
    assert isinstance(parsed_rule.condition.children[1], GroupNode)


def test_parses_set_final_state_action(tmp_path: Path) -> None:
    rule = valid_rule(
        actions=[
            {
                "type": "SET_FINAL_STATE",
                "parameters": {"state": "OnHold"},
            }
        ]
    )

    parsed_rule = JsonRuleRepository(write_rules(tmp_path, [rule])).list_enabled()[0]
    action = parsed_rule.actions[0]

    assert action.action_type == RuleActionType.SET_FINAL_STATE
    assert isinstance(action.parameters, SetFinalStateParameters)
    assert action.parameters.state == OrderState.ON_HOLD


def test_distinct_rule_ids_load_successfully(tmp_path: Path) -> None:
    first_rule = valid_rule(id="rule-1")
    second_rule = valid_rule(id="rule-2")

    rules = JsonRuleRepository(write_rules(tmp_path, [first_rule, second_rule])).list_enabled()

    assert [rule.id for rule in rules] == ["rule-1", "rule-2"]


def test_duplicate_rule_ids_fail(tmp_path: Path) -> None:
    first_rule = valid_rule(id="duplicate-rule")
    second_rule = valid_rule(id="duplicate-rule")

    with pytest.raises(RuleConfigurationError, match="duplicate-rule"):
        JsonRuleRepository(write_rules(tmp_path, [first_rule, second_rule]))


def test_duplicate_rule_ids_fail_even_when_one_rule_is_disabled(
    tmp_path: Path,
) -> None:
    first_rule = valid_rule(id="duplicate-rule", enabled=False)
    second_rule = valid_rule(id="duplicate-rule", enabled=True)

    with pytest.raises(RuleConfigurationError, match="duplicate-rule"):
        JsonRuleRepository(write_rules(tmp_path, [first_rule, second_rule]))


@pytest.mark.parametrize(
    ("field", "operator"),
    [
        ("destinationCountry", "GREATER_THAN"),
        ("manualReviewRequired", "LESS_THAN"),
    ],
)
def test_rejects_numeric_comparison_on_non_numeric_field(
    tmp_path: Path,
    field: str,
    operator: str,
) -> None:
    rule = valid_rule(
        condition={
            "type": "CONDITION",
            "field": field,
            "operator": operator,
            "value": 5,
        }
    )

    with pytest.raises(
        RuleConfigurationError,
        match=f"{operator} is incompatible with field {field}",
    ):
        JsonRuleRepository(write_rules(tmp_path, [rule]))


@pytest.mark.parametrize("field", ["amount", "productCount"])
def test_allows_numeric_comparison_on_numeric_fields(
    tmp_path: Path,
    field: str,
) -> None:
    rule = valid_rule(
        condition={
            "type": "CONDITION",
            "field": field,
            "operator": "LESS_THAN",
            "value": 5000,
        }
    )

    parsed_rule = JsonRuleRepository(write_rules(tmp_path, [rule])).list_enabled()[0]

    assert isinstance(parsed_rule.condition, ConditionNode)
    assert parsed_rule.condition.field.value == field


@pytest.mark.parametrize(
    ("update", "message"),
    [
        (
            {
                "condition": {
                    "type": "CONDITION",
                    "field": "unknown",
                    "operator": "EQUALS",
                    "value": "x",
                }
            },
            "unsupported value",
        ),
        (
            {
                "condition": {
                    "type": "CONDITION",
                    "field": "amount",
                    "operator": "CONTAINS",
                    "value": 100,
                }
            },
            "unsupported value",
        ),
        (
            {
                "actions": [
                    {
                        "type": "SEND_EMAIL",
                        "parameters": {},
                    }
                ]
            },
            "unsupported value",
        ),
        (
            {
                "actions": [
                    {
                        "type": "SET_FINAL_STATE",
                        "parameters": {"state": "NeedsCoffee"},
                    }
                ]
            },
            "unsupported value",
        ),
        (
            {
                "actions": [
                    {
                        "type": "ADD_TAX",
                        "parameters": {"percentage": -1},
                    }
                ]
            },
            "finite non-negative number",
        ),
        (
            {
                "condition": {
                    "type": "GROUP",
                    "operator": "AND",
                    "children": [],
                }
            },
            "at least one node",
        ),
    ],
)
def test_rejects_invalid_rule_configuration(
    tmp_path: Path,
    update: dict,
    message: str,
) -> None:
    rule = valid_rule(**update)

    with pytest.raises(RuleConfigurationError, match=message):
        JsonRuleRepository(write_rules(tmp_path, [rule]))


def test_parses_action_parameters_as_typed_values(tmp_path: Path) -> None:
    parsed_rule = JsonRuleRepository(write_rules(tmp_path, [valid_rule()])).list_enabled()[0]
    action = parsed_rule.actions[0]

    assert isinstance(action.parameters, AddTaxParameters)
    assert action.parameters.percentage == pytest.approx(10)
