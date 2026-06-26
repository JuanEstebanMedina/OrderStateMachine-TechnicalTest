from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, TypeAlias

from app.domain.order import Order
from app.domain.order_event import OrderEventType
from app.domain.order_state import OrderState


class LogicalOperator(str, Enum):
    AND = "AND"
    OR = "OR"


class ComparisonOperator(str, Enum):
    EQUALS = "EQUALS"
    NOT_EQUALS = "NOT_EQUALS"
    GREATER_THAN = "GREATER_THAN"
    LESS_THAN = "LESS_THAN"
    IN = "IN"


class RuleField(str, Enum):
    AMOUNT = "amount"
    PRODUCT_COUNT = "productCount"
    CURRENT_STATE = "currentState"
    PROPOSED_STATE = "proposedState"
    EVENT_TYPE = "eventType"
    ORIGIN_COUNTRY = "originCountry"
    DESTINATION_COUNTRY = "destinationCountry"
    MANUAL_REVIEW_REQUIRED = "manualReviewRequired"


class RuleActionType(str, Enum):
    CREATE_SUPPORT_TICKET = "CREATE_SUPPORT_TICKET"
    ADD_TAX = "ADD_TAX"
    ADD_FIXED_COST = "ADD_FIXED_COST"
    SET_FINAL_STATE = "SET_FINAL_STATE"


@dataclass(frozen=True)
class ConditionNode:
    field: RuleField
    operator: ComparisonOperator
    value: Any


@dataclass(frozen=True)
class GroupNode:
    operator: LogicalOperator
    children: tuple[RuleNode, ...]


RuleNode: TypeAlias = ConditionNode | GroupNode


@dataclass(frozen=True)
class CreateSupportTicketParameters:
    reason: str


@dataclass(frozen=True)
class AddTaxParameters:
    percentage: float


@dataclass(frozen=True)
class AddFixedCostParameters:
    amount: float


@dataclass(frozen=True)
class SetFinalStateParameters:
    state: OrderState


RuleActionParameters: TypeAlias = (
    CreateSupportTicketParameters
    | AddTaxParameters
    | AddFixedCostParameters
    | SetFinalStateParameters
)


@dataclass(frozen=True)
class RuleAction:
    action_type: RuleActionType
    parameters: RuleActionParameters


@dataclass(frozen=True)
class OrderRule:
    id: str
    name: str
    enabled: bool
    event_type: OrderEventType
    from_states: tuple[OrderState, ...]
    condition: RuleNode
    actions: tuple[RuleAction, ...]


@dataclass(frozen=True)
class RuleContext:
    order: Order
    event_type: OrderEventType
    event_metadata: dict[str, Any]
    from_state: OrderState
    proposed_state: OrderState


@dataclass(frozen=True)
class RuleIndexKey:
    event_type: OrderEventType
    from_state: OrderState


@dataclass(frozen=True)
class SupportTicketDraft:
    source_rule_id: str
    reason: str


@dataclass(frozen=True)
class RuleActionEffect:
    tax_percentage: float = 0.0
    fixed_cost: float = 0.0
    support_ticket_draft: SupportTicketDraft | None = None
    final_state_override: OrderState | None = None


@dataclass(frozen=True)
class RuleEngineResult:
    matched_rule_ids: tuple[str, ...]
    total_tax_percentage: float
    total_fixed_cost: float
    support_ticket_drafts: tuple[SupportTicketDraft, ...]
    final_state_override: OrderState | None
    final_state_override_rule_ids: tuple[str, ...] = ()
