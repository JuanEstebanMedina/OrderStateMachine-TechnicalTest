from uuid import UUID

from app.adapters import InMemoryOrderRepository, InMemorySupportTicketRepository
from app.domain import Order, OrderState, SupportTicket


ORDER_ID = UUID("11111111-1111-1111-1111-111111111111")
SECOND_ORDER_ID = UUID("11111111-1111-1111-1111-111111111112")
MISSING_ORDER_ID = UUID("11111111-1111-1111-1111-111111111199")
TICKET_ID = UUID("22222222-2222-2222-2222-222222222222")
SECOND_TICKET_ID = UUID("22222222-2222-2222-2222-222222222223")
THIRD_TICKET_ID = UUID("22222222-2222-2222-2222-222222222224")
MISSING_TICKET_ID = UUID("22222222-2222-2222-2222-222222222299")


def test_saves_and_retrieves_order() -> None:
    repository = InMemoryOrderRepository()
    order = Order(id=ORDER_ID, product_ids=["product-1"], amount=100.0)

    saved_order = repository.save(order)
    retrieved_order = repository.get_by_id(ORDER_ID)

    assert saved_order == order
    assert retrieved_order == order


def test_returns_none_when_order_does_not_exist() -> None:
    repository = InMemoryOrderRepository()

    assert repository.get_by_id(MISSING_ORDER_ID) is None


def test_lists_all_orders() -> None:
    repository = InMemoryOrderRepository()
    order_1 = Order(id=ORDER_ID, product_ids=["product-1"], amount=100.0)
    order_2 = Order(id=SECOND_ORDER_ID, product_ids=["product-2"], amount=200.0)

    repository.save(order_1)
    repository.save(order_2)

    assert repository.list_all() == [order_1, order_2]


def test_saves_and_retrieves_support_ticket() -> None:
    repository = InMemorySupportTicketRepository()
    ticket = SupportTicket(
        id=TICKET_ID,
        order_id=ORDER_ID,
        reason="Payment failed",
        metadata={"amount": 1200.0},
    )

    saved_ticket = repository.save(ticket)
    retrieved_ticket = repository.get_by_id(TICKET_ID)

    assert saved_ticket == ticket
    assert retrieved_ticket == ticket


def test_returns_none_when_support_ticket_does_not_exist() -> None:
    repository = InMemorySupportTicketRepository()

    assert repository.get_by_id(MISSING_TICKET_ID) is None


def test_lists_all_support_tickets() -> None:
    repository = InMemorySupportTicketRepository()
    ticket_1 = SupportTicket(
        id=TICKET_ID,
        order_id=ORDER_ID,
        reason="Payment failed",
        metadata={"amount": 1200.0},
    )
    ticket_2 = SupportTicket(
        id=SECOND_TICKET_ID,
        order_id=SECOND_ORDER_ID,
        reason="Delivery issue",
        metadata={"carrier": "local"},
    )

    repository.save(ticket_1)
    repository.save(ticket_2)

    assert repository.list_all() == [ticket_1, ticket_2]


def test_lists_support_tickets_by_order_id() -> None:
    repository = InMemorySupportTicketRepository()
    ticket_1 = SupportTicket(
        id=TICKET_ID,
        order_id=ORDER_ID,
        reason="Payment failed",
        metadata={"amount": 1200.0},
    )
    ticket_2 = SupportTicket(
        id=SECOND_TICKET_ID,
        order_id=ORDER_ID,
        reason="Delivery issue",
        metadata={"carrier": "local"},
    )
    ticket_3 = SupportTicket(
        id=THIRD_TICKET_ID,
        order_id=SECOND_ORDER_ID,
        reason="Payment failed",
        metadata={"amount": 1400.0},
    )

    repository.save(ticket_1)
    repository.save(ticket_2)
    repository.save(ticket_3)

    assert repository.list_by_order_id(ORDER_ID) == [ticket_1, ticket_2]


def test_returned_order_changes_do_not_mutate_repository_storage() -> None:
    repository = InMemoryOrderRepository()
    order = Order(id=ORDER_ID, product_ids=["product-1"], amount=100.0)
    repository.save(order)

    retrieved_order = repository.get_by_id(ORDER_ID)
    assert retrieved_order is not None

    retrieved_order.product_ids.append("product-2")
    retrieved_order.current_state = OrderState.CONFIRMED

    stored_order = repository.get_by_id(ORDER_ID)

    assert stored_order == order


def test_returned_support_ticket_changes_do_not_mutate_repository_storage() -> None:
    repository = InMemorySupportTicketRepository()
    ticket = SupportTicket(
        id=TICKET_ID,
        order_id=ORDER_ID,
        reason="Payment failed",
        metadata={"amount": 1200.0},
    )
    repository.save(ticket)

    retrieved_ticket = repository.get_by_id(TICKET_ID)
    assert retrieved_ticket is not None

    retrieved_ticket.reason = "Changed reason"
    retrieved_ticket.metadata["amount"] = 900.0

    stored_ticket = repository.get_by_id(TICKET_ID)

    assert stored_ticket == ticket
