from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, TypeGuard

from app.domain import (
    AddFixedCostParameters,
    AddTaxParameters,
    ComparisonOperator,
    ConditionNode,
    CreateSupportTicketParameters,
    GroupNode,
    LogicalOperator,
    OrderRule,
    OrderEventType,
    OrderState,
    RuleAction,
    RuleActionType,
    RuleConfigurationError,
    RuleField,
    RuleNode,
    SetFinalStateParameters,
)
from app.ports import RuleRepository


NUMERIC_RULE_FIELDS = {
    RuleField.AMOUNT,
    RuleField.PRODUCT_COUNT,
}


class JsonRuleRepository(RuleRepository):
    """Loads and validates local JSON rule definitions once at construction."""

    def __init__(self, rules_path: str | Path) -> None:
        self._rules_path = Path(rules_path)
        self._rules = tuple(self._load_rules())

    def list_enabled(self) -> list[OrderRule]:
        return [rule for rule in self._rules if rule.enabled]

    def _load_rules(self) -> list[OrderRule]:
        try:
            raw_document = json.loads(self._rules_path.read_text(encoding="utf-8"))
        except OSError as error:
            raise RuleConfigurationError(
                f"Could not read rule configuration {self._rules_path}"
            ) from error
        except json.JSONDecodeError as error:
            raise RuleConfigurationError(
                f"Invalid JSON rule configuration {self._rules_path}: {error.msg}"
            ) from error

        rules = _required_list(raw_document, "rules", "rule configuration")
        parsed_rules = [
            _parse_rule(raw_rule, index) for index, raw_rule in enumerate(rules)
        ]
        _validate_unique_rule_ids(parsed_rules)
        return parsed_rules


def _parse_rule(raw_rule: Any, index: int) -> OrderRule:
    path = f"rules[{index}]"
    if not isinstance(raw_rule, dict):
        raise RuleConfigurationError(f"{path} must be an object")

    rule_id = _required_non_empty_string(raw_rule, "id", path)
    name = _required_non_empty_string(raw_rule, "name", path)
    enabled = _required_bool(raw_rule, "enabled", path)
    event_type = _parse_enum(
        OrderEventType,
        _required_non_empty_string(raw_rule, "eventType", path),
        f"{path}.eventType",
    )
    from_states = tuple(
        _parse_enum(OrderState, state, f"{path}.fromStates[{state_index}]")
        for state_index, state in enumerate(_required_list(raw_rule, "fromStates", path))
    )
    if not from_states:
        raise RuleConfigurationError(f"{path}.fromStates must contain at least one state")

    actions = tuple(
        _parse_action(raw_action, f"{path}.actions[{action_index}]")
        for action_index, raw_action in enumerate(
            _required_list(raw_rule, "actions", path)
        )
    )
    if not actions:
        raise RuleConfigurationError(f"{path}.actions must contain at least one action")

    return OrderRule(
        id=rule_id,
        name=name,
        enabled=enabled,
        event_type=event_type,
        from_states=from_states,
        condition=_parse_node(
            _required_object(raw_rule, "condition", path),
            f"{path}.condition",
        ),
        actions=actions,
    )


def _parse_node(raw_node: Any, path: str) -> RuleNode:
    if not isinstance(raw_node, dict):
        raise RuleConfigurationError(f"{path} must be an object")

    node_type = _required_non_empty_string(raw_node, "type", path)
    if node_type == "CONDITION":
        field = _parse_enum(
            RuleField,
            _required_non_empty_string(raw_node, "field", path),
            f"{path}.field",
        )
        operator = _parse_comparison_operator(raw_node, path)
        return ConditionNode(
            field=field,
            operator=operator,
            value=_parse_condition_value(raw_node, path, field, operator),
        )

    if node_type == "GROUP":
        operator = _parse_enum(
            LogicalOperator,
            _required_non_empty_string(raw_node, "operator", path),
            f"{path}.operator",
        )
        children = tuple(
            _parse_node(child, f"{path}.children[{child_index}]")
            for child_index, child in enumerate(
                _required_list(raw_node, "children", path)
            )
        )
        if not children:
            raise RuleConfigurationError(f"{path}.children must contain at least one node")
        return GroupNode(operator=operator, children=children)

    raise RuleConfigurationError(f"{path}.type must be CONDITION or GROUP")


def _parse_comparison_operator(raw_node: dict[str, Any], path: str) -> ComparisonOperator:
    return _parse_enum(
        ComparisonOperator,
        _required_non_empty_string(raw_node, "operator", path),
        f"{path}.operator",
    )


def _parse_condition_value(
    raw_node: dict[str, Any],
    path: str,
    field: RuleField,
    operator: ComparisonOperator,
) -> Any:
    if "value" not in raw_node:
        raise RuleConfigurationError(f"{path}.value is required")

    value = raw_node["value"]
    if operator in {ComparisonOperator.GREATER_THAN, ComparisonOperator.LESS_THAN}:
        if field not in NUMERIC_RULE_FIELDS:
            raise RuleConfigurationError(
                f"{path}.operator {operator.value} is incompatible with "
                f"field {field.value}"
            )

        if not _is_finite_number(value):
            raise RuleConfigurationError(
                f"{path}.value must be a finite number for {operator.value}"
            )

    if operator == ComparisonOperator.IN:
        if not isinstance(value, list):
            raise RuleConfigurationError(f"{path}.value must be a list for IN")
        return tuple(value)

    return value


def _parse_action(raw_action: Any, path: str) -> RuleAction:
    if not isinstance(raw_action, dict):
        raise RuleConfigurationError(f"{path} must be an object")

    action_type = _parse_enum(
        RuleActionType,
        _required_non_empty_string(raw_action, "type", path),
        f"{path}.type",
    )
    parameters = _required_object(raw_action, "parameters", path)

    if action_type == RuleActionType.CREATE_SUPPORT_TICKET:
        reason = _required_non_empty_string(parameters, "reason", f"{path}.parameters")
        return RuleAction(
            action_type=action_type,
            parameters=CreateSupportTicketParameters(reason=reason),
        )

    if action_type == RuleActionType.ADD_TAX:
        percentage = _required_non_negative_number(
            parameters,
            "percentage",
            f"{path}.parameters",
        )
        return RuleAction(
            action_type=action_type,
            parameters=AddTaxParameters(percentage=percentage),
        )

    if action_type == RuleActionType.ADD_FIXED_COST:
        amount = _required_non_negative_number(parameters, "amount", f"{path}.parameters")
        return RuleAction(
            action_type=action_type,
            parameters=AddFixedCostParameters(amount=amount),
        )

    # MVP boundary: SET_FINAL_STATE currently accepts any known state.
    # Runtime-managed rules should restrict targets by event and source state.
    state = _parse_enum(
        OrderState,
        _required_non_empty_string(parameters, "state", f"{path}.parameters"),
        f"{path}.parameters.state",
    )
    return RuleAction(
        action_type=action_type,
        parameters=SetFinalStateParameters(state=state),
    )


def _required_object(data: dict[str, Any], key: str, path: str) -> dict[str, Any]:
    if key not in data or not isinstance(data[key], dict):
        raise RuleConfigurationError(f"{path}.{key} must be an object")
    return data[key]


def _required_list(data: Any, key: str, path: str) -> list[Any]:
    if not isinstance(data, dict) or key not in data or not isinstance(data[key], list):
        raise RuleConfigurationError(f"{path}.{key} must be a list")
    return data[key]


def _required_non_empty_string(data: dict[str, Any], key: str, path: str) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise RuleConfigurationError(f"{path}.{key} must be a non-empty string")
    return value


def _required_bool(data: dict[str, Any], key: str, path: str) -> bool:
    value = data.get(key)
    if not isinstance(value, bool):
        raise RuleConfigurationError(f"{path}.{key} must be a boolean")
    return value


def _required_non_negative_number(
    data: dict[str, Any],
    key: str,
    path: str,
) -> float:
    value = data.get(key)
    if not _is_finite_number(value):
        raise RuleConfigurationError(
            f"{path}.{key} must be a finite non-negative number"
        )

    if value < 0:
        raise RuleConfigurationError(
            f"{path}.{key} must be a finite non-negative number"
        )
    return float(value)


def _validate_unique_rule_ids(rules: list[OrderRule]) -> None:
    seen_rule_ids: set[str] = set()
    for rule in rules:
        if rule.id in seen_rule_ids:
            raise RuleConfigurationError(f"Duplicate rule id {rule.id!r}")
        seen_rule_ids.add(rule.id)


def _parse_enum(enum_type: type[Any], value: Any, path: str) -> Any:
    try:
        return enum_type(value)
    except ValueError as error:
        raise RuleConfigurationError(f"{path} has unsupported value {value!r}") from error


def _is_finite_number(value: Any) -> TypeGuard[int | float]:
    return (
        isinstance(value, int | float)
        and not isinstance(value, bool)
        and math.isfinite(value)
    )
