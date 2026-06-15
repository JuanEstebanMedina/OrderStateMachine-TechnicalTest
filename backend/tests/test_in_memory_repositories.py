from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Barrier
from uuid import UUID

import pytest

from app.adapters import (
    InMemoryOrderRepository,
    InMemoryStore,
    InMemorySupportTicketRepository,
)
from app.domain import (
    Order,
    OrderEventLog,
    OrderEventType,
    OrderState,
    OrderVersionConflictError,
    SupportTicket,
)


ORDER_ID = UUID("11111111-1111-1111-1111-111111111111")
SECOND_ORDER_ID = UUID("11111111-1111-1111-1111-111111111112")
MISSING_ORDER_ID = UUID("11111111-1111-1111-1111-111111111199")
EVENT_ID = UUID("22222222-2222-2222-2222-222222222222")
SECOND_EVENT_ID = UUID("22222222-2222-2222-2222-222222222223")
TICKET_ID = UUID("33333333-3333-3333-3333-333333333333")
MISSING_TICKET_ID = UUID("33333333-3333-3333-3333-333333333399")


def event_log(
    event_id: UUID = EVENT_ID,
    from_state: OrderState = OrderState.PENDING,
    to_state: OrderState = OrderState.PENDING_PAYMENT,
) -> OrderEventLog:
    return OrderEventLog(
        id=event_id,
        event_type=OrderEventType.NO_VERIFICATION_NEEDED,
        from_state=from_state,
        to_state=to_state,
        metadata={"source": "test"},
        created_at=datetime.now(timezone.utc),
    )


def updated_order(
    order: Order,
    log: OrderEventLog,
    version: int = 1,
) -> Order:
    return Order(
        id=order.id,
        product_ids=[*order.product_ids],
        amount=order.amount,
        current_state=log.to_state,
        history=[*order.history, log],
        created_at=order.created_at,
        updated_at=log.created_at,
        version=version,
    )


def support_ticket(order_id: UUID = ORDER_ID) -> SupportTicket:
    return SupportTicket(
        id=TICKET_ID,
        order_id=order_id,
        reason="Payment failed",
        metadata={"amount": 1200.0},
    )


def create_repositories() -> tuple[
    InMemoryOrderRepository,
    InMemorySupportTicketRepository,
]:
    store = InMemoryStore()
    return InMemoryOrderRepository(store), InMemorySupportTicketRepository(store)


def test_create_stores_order_at_version_zero() -> None:
    order_repository, _ticket_repository = create_repositories()
    order = Order(id=ORDER_ID, product_ids=["product-1"], amount=100.0)

    saved_order = order_repository.create(order)
    retrieved_order = order_repository.get_by_id(ORDER_ID)

    assert saved_order == order
    assert saved_order.version == 0
    assert retrieved_order == order


def test_returns_none_when_order_does_not_exist() -> None:
    order_repository, _ticket_repository = create_repositories()

    assert order_repository.get_by_id(MISSING_ORDER_ID) is None


def test_list_summaries_excludes_history() -> None:
    order_repository, _ticket_repository = create_repositories()
    order = Order(
        id=ORDER_ID,
        product_ids=["product-1"],
        amount=100.0,
        history=[event_log()],
    )
    order_repository.create(order)

    summaries = order_repository.list_summaries()

    assert len(summaries) == 1
    assert summaries[0].id == ORDER_ID
    assert summaries[0].product_ids == ["product-1"]
    assert not hasattr(summaries[0], "history")


def test_commit_transition_increments_version_and_persists_history() -> None:
    order_repository, _ticket_repository = create_repositories()
    order = order_repository.create(
        Order(id=ORDER_ID, product_ids=["product-1"], amount=100.0)
    )
    log = event_log()
    committed_order = updated_order(order, log, version=1)

    result = order_repository.commit_transition(
        order=committed_order,
        event_log=log,
        support_ticket=None,
        expected_version=0,
    )

    stored_order = order_repository.get_by_id(ORDER_ID)
    assert result.version == 1
    assert stored_order == committed_order


def test_commit_transition_persists_ticket_atomically() -> None:
    order_repository, ticket_repository = create_repositories()
    order = order_repository.create(
        Order(id=ORDER_ID, product_ids=["product-1"], amount=1500.0)
    )
    log = event_log(to_state=OrderState.CANCELLED)
    ticket = support_ticket()

    order_repository.commit_transition(
        order=updated_order(order, log, version=1),
        event_log=log,
        support_ticket=ticket,
        expected_version=0,
    )

    assert ticket_repository.get_by_id(TICKET_ID) == ticket
    assert ticket_repository.list_by_order_id(ORDER_ID) == [ticket]


def test_stale_expected_version_raises_conflict_without_partial_writes() -> None:
    order_repository, ticket_repository = create_repositories()
    order = order_repository.create(
        Order(id=ORDER_ID, product_ids=["product-1"], amount=1500.0)
    )
    first_log = event_log()
    second_log = event_log(
        event_id=SECOND_EVENT_ID,
        to_state=OrderState.CANCELLED,
    )
    order_repository.commit_transition(
        order=updated_order(order, first_log, version=1),
        event_log=first_log,
        support_ticket=None,
        expected_version=0,
    )

    with pytest.raises(OrderVersionConflictError):
        order_repository.commit_transition(
            order=updated_order(order, second_log, version=1),
            event_log=second_log,
            support_ticket=support_ticket(),
            expected_version=0,
        )

    stored_order = order_repository.get_by_id(ORDER_ID)
    assert stored_order is not None
    assert stored_order.history == [first_log]
    assert ticket_repository.get_by_id(TICKET_ID) is None
    assert ticket_repository.list_all() == []


def test_stale_from_state_raises_conflict() -> None:
    order_repository, _ticket_repository = create_repositories()
    order = order_repository.create(
        Order(id=ORDER_ID, product_ids=["product-1"], amount=100.0)
    )
    log = event_log(from_state=OrderState.ON_HOLD)

    with pytest.raises(OrderVersionConflictError):
        order_repository.commit_transition(
            order=updated_order(order, log, version=1),
            event_log=log,
            support_ticket=None,
            expected_version=0,
        )


def test_returned_order_changes_do_not_mutate_repository_storage() -> None:
    order_repository, _ticket_repository = create_repositories()
    order = Order(id=ORDER_ID, product_ids=["product-1"], amount=100.0)
    order_repository.create(order)

    retrieved_order = order_repository.get_by_id(ORDER_ID)
    assert retrieved_order is not None

    retrieved_order.product_ids.append("product-2")
    retrieved_order.current_state = OrderState.CONFIRMED

    stored_order = order_repository.get_by_id(ORDER_ID)

    assert stored_order == order


def test_returned_support_ticket_changes_do_not_mutate_repository_storage() -> None:
    order_repository, ticket_repository = create_repositories()
    order = order_repository.create(
        Order(id=ORDER_ID, product_ids=["product-1"], amount=1200.0)
    )
    log = event_log(to_state=OrderState.CANCELLED)
    ticket = support_ticket()
    order_repository.commit_transition(
        order=updated_order(order, log, version=1),
        event_log=log,
        support_ticket=ticket,
        expected_version=0,
    )

    retrieved_ticket = ticket_repository.get_by_id(TICKET_ID)
    assert retrieved_ticket is not None

    retrieved_ticket.reason = "Changed reason"
    retrieved_ticket.metadata["amount"] = 900.0

    stored_ticket = ticket_repository.get_by_id(TICKET_ID)

    assert stored_ticket == ticket


def test_returns_none_when_support_ticket_does_not_exist() -> None:
    _order_repository, ticket_repository = create_repositories()

    assert ticket_repository.get_by_id(MISSING_TICKET_ID) is None


def test_different_orders_can_transition_concurrently() -> None:
    order_repository, _ticket_repository = create_repositories()
    orders = [
        order_repository.create(
            Order(
                id=UUID(f"11111111-1111-1111-1111-{index:012d}"),
                product_ids=[f"product-{index}"],
                amount=100.0,
            )
        )
        for index in range(10)
    ]

    def commit(index: int) -> None:
        order = orders[index]
        log = event_log(
            event_id=UUID(f"22222222-2222-2222-2222-{index:012d}"),
        )
        order_repository.commit_transition(
            order=updated_order(order, log, version=1),
            event_log=log,
            support_ticket=None,
            expected_version=0,
        )

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(commit, index) for index in range(len(orders))]
        for future in futures:
            future.result(timeout=5)

    assert all(
        order_repository.get_by_id(order.id).version == 1
        for order in orders
        if order_repository.get_by_id(order.id) is not None
    )


def test_two_stale_updates_to_same_order_allow_exactly_one_success() -> None:
    order_repository, ticket_repository = create_repositories()
    order = order_repository.create(
        Order(id=ORDER_ID, product_ids=["product-1"], amount=1500.0)
    )
    barrier = Barrier(2)

    def commit(event_id: UUID) -> str:
        log = event_log(event_id=event_id)
        barrier.wait(timeout=5)
        try:
            order_repository.commit_transition(
                order=updated_order(order, log, version=1),
                event_log=log,
                support_ticket=support_ticket(),
                expected_version=0,
            )
        except OrderVersionConflictError:
            return "conflict"
        return "success"

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(commit, EVENT_ID),
            executor.submit(commit, SECOND_EVENT_ID),
        ]
        results = [future.result(timeout=5) for future in futures]

    assert sorted(results) == ["conflict", "success"]
    stored_order = order_repository.get_by_id(ORDER_ID)
    assert stored_order is not None
    assert stored_order.version == 1
    assert len(stored_order.history) == 1
    assert len(ticket_repository.list_all()) == 1
