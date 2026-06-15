from typing import Annotated

from fastapi import Depends

from app.adapters import InMemoryOrderRepository, InMemorySupportTicketRepository
from app.ports import OrderRepository, SupportTicketRepository
from app.services import OrderService, OrderStateMachine


_order_repository: OrderRepository = InMemoryOrderRepository()
_support_ticket_repository: SupportTicketRepository = (
    InMemorySupportTicketRepository()
)
_state_machine = OrderStateMachine()


def get_order_repository() -> OrderRepository:
    return _order_repository


def get_support_ticket_repository() -> SupportTicketRepository:
    return _support_ticket_repository


def get_state_machine() -> OrderStateMachine:
    return _state_machine


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


OrderServiceDependency = Annotated[
    OrderService,
    Depends(get_order_service),
]

StateMachineDependency = Annotated[
    OrderStateMachine,
    Depends(get_state_machine),
]
