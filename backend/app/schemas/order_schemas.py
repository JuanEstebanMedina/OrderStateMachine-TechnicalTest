from datetime import datetime
import math
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain import OrderEventType, OrderState


class CreateOrderRequest(BaseModel):
    product_ids: list[str] = Field(alias="productIds")
    amount: float

    @field_validator("product_ids")
    @classmethod
    def validate_product_ids(cls, product_ids: list[str]) -> list[str]:
        normalized_product_ids: list[str] = []
        seen_product_ids: set[str] = set()

        for product_id in product_ids:
            normalized_product_id = product_id.strip()
            if not normalized_product_id:
                raise ValueError("Product IDs must contain non-whitespace characters")

            if normalized_product_id in seen_product_ids:
                continue

            seen_product_ids.add(normalized_product_id)
            normalized_product_ids.append(normalized_product_id)

        if not normalized_product_ids:
            raise ValueError("At least one product ID is required")

        return normalized_product_ids

    @field_validator("amount", mode="before")
    @classmethod
    def normalize_non_finite_amount_input(cls, amount: Any) -> Any:
        if isinstance(amount, float) and not math.isfinite(amount):
            return None

        if isinstance(amount, str):
            try:
                parsed_amount = float(amount)
            except ValueError:
                return amount

            if not math.isfinite(parsed_amount):
                return None

        return amount

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, amount: float) -> float:
        if not math.isfinite(amount):
            raise ValueError("Amount must be finite")

        if amount <= 0:
            raise ValueError("Amount must be greater than zero")

        return amount

    model_config = ConfigDict(populate_by_name=True)


class ApplyOrderEventRequest(BaseModel):
    event_type: OrderEventType = Field(alias="eventType")
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True)


class OrderEventLogResponse(BaseModel):
    event_type: OrderEventType = Field(alias="eventType")
    from_state: OrderState = Field(alias="fromState")
    to_state: OrderState = Field(alias="toState")
    metadata: dict[str, Any]
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class OrderSummaryResponse(BaseModel):
    id: UUID = Field(alias="orderId")
    product_ids: list[str] = Field(alias="productIds")
    amount: float
    current_state: OrderState = Field(alias="currentState")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class OrderResponse(BaseModel):
    id: UUID = Field(alias="orderId")
    product_ids: list[str] = Field(alias="productIds")
    amount: float
    current_state: OrderState = Field(alias="currentState")
    history: list[OrderEventLogResponse]
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class AvailableEventsResponse(BaseModel):
    events: list[OrderEventType]


class StateMachineTransitionResponse(BaseModel):
    from_state: OrderState = Field(alias="fromState")
    event_type: OrderEventType = Field(alias="eventType")
    to_state: OrderState = Field(alias="toState")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class StateMachineDefinitionResponse(BaseModel):
    initial_state: OrderState = Field(alias="initialState")
    states: list[OrderState]
    transitions: list[StateMachineTransitionResponse]

    model_config = ConfigDict(populate_by_name=True)
