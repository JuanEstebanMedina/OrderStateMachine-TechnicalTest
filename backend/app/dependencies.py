from typing import Annotated

import boto3
from fastapi import Depends

from app.adapters import (
    DynamoDBOrderRepository,
    DynamoDBSupportTicketRepository,
    InMemoryOrderRepository,
    InMemoryStore,
    InMemorySupportTicketRepository,
)
from app.config import (
    get_aws_region,
    get_dynamodb_endpoint_url,
    get_dynamodb_table_name,
    get_persistence_backend,
)
from app.ports import OrderRepository, SupportTicketRepository
from app.services import OrderService, OrderStateMachine


def _create_dynamodb_client():
    return boto3.client(
        "dynamodb",
        region_name=get_aws_region(),
        endpoint_url=get_dynamodb_endpoint_url(),
    )


def _create_order_repository() -> tuple[OrderRepository, SupportTicketRepository]:
    if get_persistence_backend() == "memory":
        in_memory_store = InMemoryStore()
        return (
            InMemoryOrderRepository(in_memory_store),
            InMemorySupportTicketRepository(in_memory_store),
        )

    client = _create_dynamodb_client()
    table_name = get_dynamodb_table_name()
    return (
        DynamoDBOrderRepository(client, table_name),
        DynamoDBSupportTicketRepository(client, table_name),
    )


_order_repository, _support_ticket_repository = _create_order_repository()
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
    state_machine: Annotated[
        OrderStateMachine,
        Depends(get_state_machine),
    ],
) -> OrderService:
    return OrderService(
        order_repository=order_repository,
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
