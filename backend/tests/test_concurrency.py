from concurrent.futures import ThreadPoolExecutor
from uuid import UUID

from app.adapters import InMemoryOrderRepository
from app.domain import Order, OrderEventType, OrderState
from app.services import OrderService, OrderStateMachine


def test_processes_events_for_different_orders_concurrently() -> None:
    order_repository = InMemoryOrderRepository()
    service = OrderService(
        order_repository=order_repository,
        state_machine=OrderStateMachine(),
    )
    orders = [
        service.create_order(product_ids=[f"product-{index}"], amount=100.0)
        for index in range(20)
    ]

    def apply_event(index: int) -> None:
        service.apply_event(
            order_id=orders[index].id,
            event_type=OrderEventType.NO_VERIFICATION_NEEDED,
            metadata={"index": index},
        )

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(apply_event, index) for index in range(len(orders))]
        for future in futures:
            future.result(timeout=5)

    assert len(order_repository.list_summaries()) == len(orders)

    for index, order in enumerate(orders):
        stored_order = order_repository.get_by_id(order.id)
        assert stored_order is not None
        assert stored_order.current_state == OrderState.PENDING_PAYMENT
        assert len(stored_order.history) == 1

        history_entry = stored_order.history[0]
        assert history_entry.from_state == OrderState.PENDING
        assert history_entry.to_state == OrderState.PENDING_PAYMENT
        assert history_entry.event_type == OrderEventType.NO_VERIFICATION_NEEDED
        assert history_entry.metadata == {"index": index}


def test_saves_distinct_orders_concurrently() -> None:
    repository = InMemoryOrderRepository()
    orders = [
        Order(
            id=UUID(f"11111111-1111-1111-1111-{index:012d}"),
            product_ids=[f"product-{index}"],
            amount=100.0,
        )
        for index in range(20)
    ]

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(repository.create, order) for order in orders]
        for future in futures:
            future.result(timeout=5)

    stored_orders = repository.list_summaries()

    assert len(stored_orders) == len(orders)
    assert {order.id for order in stored_orders} == {order.id for order in orders}
