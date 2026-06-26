from unittest.mock import create_autospec

from app.dependencies import get_order_service, get_rule_engine
from app.ports import OrderRepository
from app.services import OrderStateMachine


def test_rule_engine_dependency_is_singleton() -> None:
    assert get_rule_engine() is get_rule_engine()


def test_order_service_receives_rule_engine_singleton() -> None:
    order_repository = create_autospec(OrderRepository, instance=True)
    state_machine = OrderStateMachine()
    rule_engine = get_rule_engine()

    service = get_order_service(order_repository, state_machine, rule_engine)

    assert service._rule_engine is rule_engine
