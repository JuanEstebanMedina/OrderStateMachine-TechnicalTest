from typing import Protocol

from app.domain import (
    AddFixedCostParameters,
    AddTaxParameters,
    CreateSupportTicketParameters,
    OrderRule,
    RuleAction,
    RuleActionEffect,
    RuleActionType,
    RuleConfigurationError,
    RuleContext,
    SetFinalStateParameters,
    SupportTicketDraft,
)


class ActionHandler(Protocol):
    """Executes one parsed rule action and returns a pure effect."""

    def handle(
        self,
        rule: OrderRule,
        action: RuleAction,
        context: RuleContext,
    ) -> RuleActionEffect:
        ...


class CreateSupportTicketHandler:
    def handle(
        self,
        rule: OrderRule,
        action: RuleAction,
        context: RuleContext,
    ) -> RuleActionEffect:
        _ = context
        parameters = action.parameters
        if not isinstance(parameters, CreateSupportTicketParameters):
            raise RuleConfigurationError("CREATE_SUPPORT_TICKET parameters are invalid")

        return RuleActionEffect(
            support_ticket_draft=SupportTicketDraft(
                source_rule_id=rule.id,
                reason=parameters.reason,
            )
        )


class AddTaxHandler:
    def handle(
        self,
        rule: OrderRule,
        action: RuleAction,
        context: RuleContext,
    ) -> RuleActionEffect:
        _ = rule, context
        parameters = action.parameters
        if not isinstance(parameters, AddTaxParameters):
            raise RuleConfigurationError("ADD_TAX parameters are invalid")

        return RuleActionEffect(tax_percentage=parameters.percentage)


class AddFixedCostHandler:
    def handle(
        self,
        rule: OrderRule,
        action: RuleAction,
        context: RuleContext,
    ) -> RuleActionEffect:
        _ = rule, context
        parameters = action.parameters
        if not isinstance(parameters, AddFixedCostParameters):
            raise RuleConfigurationError("ADD_FIXED_COST parameters are invalid")

        return RuleActionEffect(fixed_cost=parameters.amount)


class SetFinalStateHandler:
    def handle(
        self,
        rule: OrderRule,
        action: RuleAction,
        context: RuleContext,
    ) -> RuleActionEffect:
        _ = rule, context
        parameters = action.parameters
        if not isinstance(parameters, SetFinalStateParameters):
            raise RuleConfigurationError("SET_FINAL_STATE parameters are invalid")

        return RuleActionEffect(final_state_override=parameters.state)


def build_default_action_handlers() -> dict[RuleActionType, ActionHandler]:
    return {
        RuleActionType.CREATE_SUPPORT_TICKET: CreateSupportTicketHandler(),
        RuleActionType.ADD_TAX: AddTaxHandler(),
        RuleActionType.ADD_FIXED_COST: AddFixedCostHandler(),
        RuleActionType.SET_FINAL_STATE: SetFinalStateHandler(),
    }
