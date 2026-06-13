from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.dependencies import get_order_service
from app.schemas import ApplyOrderEventRequest, CreateOrderRequest, OrderResponse
from app.services import OrderService


router = APIRouter(
    prefix="/orders",
    tags=["orders"],
)


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    request: CreateOrderRequest,
    order_service: Annotated[OrderService, Depends(get_order_service)],
):
    return order_service.create_order(
        product_ids=request.product_ids,
        amount=request.amount,
    )


@router.get("", response_model=list[OrderResponse])
def list_orders(
    order_service: Annotated[OrderService, Depends(get_order_service)],
):
    return order_service.list_orders()


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: UUID,
    order_service: Annotated[OrderService, Depends(get_order_service)],
):
    return order_service.get_order(order_id)


@router.post("/{order_id}/events", response_model=OrderResponse)
def apply_order_event(
    order_id: UUID,
    request: ApplyOrderEventRequest,
    order_service: Annotated[OrderService, Depends(get_order_service)],
):
    return order_service.apply_event(
        order_id=order_id,
        event_type=request.event_type,
        metadata=request.metadata,
    )
