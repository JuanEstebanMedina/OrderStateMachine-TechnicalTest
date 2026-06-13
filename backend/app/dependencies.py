from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.adapters import InMemoryOrderRepository, InMemorySupportTicketRepository
from app.ports import OrderRepository, SupportTicketRepository
from app.services import OrderService, OrderStateMachine


@lru_cache
def get_order_repository() -> OrderRepository:
    return InMemoryOrderRepository()


@lru_cache
def get_support_ticket_repository() -> SupportTicketRepository:
    return InMemorySupportTicketRepository()


@lru_cache
def get_state_machine() -> OrderStateMachine:
    return OrderStateMachine()


def get_order_service(
    order_repository: Annotated[
        OrderRepository,
        Depends(get_order_repository),
    ],
    support_ticket_repository: Annotated[
        SupportTicketRepository,
        Depends(get_support_ticket_repository),
    ],
    state_machine: Annotated[
        OrderStateMachine,
        Depends(get_state_machine),
    ],
) -> OrderService:
    return OrderService(
        order_repository=order_repository,
        support_ticket_repository=support_ticket_repository,
        state_machine=state_machine,
    )
