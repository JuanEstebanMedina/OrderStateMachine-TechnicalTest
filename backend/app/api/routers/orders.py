from uuid import UUID

from fastapi import APIRouter, status

from app.dependencies import OrderServiceDependency, StateMachineDependency
from app.domain import Order, OrderSummary
from app.schemas import (
    ApplyOrderEventRequest,
    AvailableEventsResponse,
    CreateOrderRequest,
    OrderResponse,
    OrderSummaryResponse,
)


router = APIRouter(
    prefix="/orders",
    tags=["orders"],
)


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    request: CreateOrderRequest,
    order_service: OrderServiceDependency,
) -> Order:
    return order_service.create_order(
        product_ids=request.product_ids,
        amount=request.amount,
    )


@router.get("", response_model=list[OrderSummaryResponse])
def list_orders(
    order_service: OrderServiceDependency,
) -> list[OrderSummary]:
    return order_service.list_orders()


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: UUID,
    order_service: OrderServiceDependency,
) -> Order:
    return order_service.get_order(order_id)


@router.get("/{order_id}/available-events")
def get_available_events(
    order_id: UUID,
    order_service: OrderServiceDependency,
    state_machine: StateMachineDependency,
) -> AvailableEventsResponse:
    order = order_service.get_order(order_id)
    return AvailableEventsResponse(
        events=state_machine.get_available_events(order.current_state),
    )


@router.post("/{order_id}/events", response_model=OrderResponse)
def apply_order_event(
    order_id: UUID,
    request: ApplyOrderEventRequest,
    order_service: OrderServiceDependency,
) -> Order:
    return order_service.apply_event(
        order_id=order_id,
        event_type=request.event_type,
        metadata=request.metadata,
    )
