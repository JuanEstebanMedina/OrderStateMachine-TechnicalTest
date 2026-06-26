from typing import Annotated
from pathlib import Path

import boto3
from fastapi import Depends

from app.adapters import (
    DynamoDBOrderRepository,
    InMemoryOrderRepository,
    InMemoryStore,
    JsonRuleRepository,
)
from app.config import (
    get_aws_region,
    get_dynamodb_endpoint_url,
    get_dynamodb_table_name,
    get_persistence_backend,
)
from app.ports import OrderRepository
from app.services import OrderService, OrderStateMachine, RuleEngine


RULES_PATH = Path(__file__).parent / "rules" / "default_rules.json"


def _create_dynamodb_client():
    return boto3.client(
        "dynamodb",
        region_name=get_aws_region(),
        endpoint_url=get_dynamodb_endpoint_url(),
    )


def _create_order_repository() -> OrderRepository:
    if get_persistence_backend() == "memory":
        in_memory_store = InMemoryStore()
        return InMemoryOrderRepository(in_memory_store)

    client = _create_dynamodb_client()
    table_name = get_dynamodb_table_name()
    return DynamoDBOrderRepository(client, table_name)


_order_repository = _create_order_repository()
_state_machine = OrderStateMachine()
_rule_repository = JsonRuleRepository(RULES_PATH)
_rule_engine = RuleEngine(_rule_repository)


def get_order_repository() -> OrderRepository:
    return _order_repository


def get_state_machine() -> OrderStateMachine:
    return _state_machine


def get_rule_engine() -> RuleEngine:
    return _rule_engine


def get_order_service(
    order_repository: Annotated[
        OrderRepository,
        Depends(get_order_repository),
    ],
    state_machine: Annotated[
        OrderStateMachine,
        Depends(get_state_machine),
    ],
    rule_engine: Annotated[
        RuleEngine,
        Depends(get_rule_engine),
    ],
) -> OrderService:
    return OrderService(
        order_repository=order_repository,
        state_machine=state_machine,
        rule_engine=rule_engine,
    )


OrderServiceDependency = Annotated[
    OrderService,
    Depends(get_order_service),
]

StateMachineDependency = Annotated[
    OrderStateMachine,
    Depends(get_state_machine),
]
