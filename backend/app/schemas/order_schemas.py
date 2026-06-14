from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.domain import OrderEventType, OrderState


class CreateOrderRequest(BaseModel):
    product_ids: list[str] = Field(alias="productIds")
    amount: float

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
