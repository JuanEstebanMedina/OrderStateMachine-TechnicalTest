from app.adapters import InMemoryOrderRepository, InMemorySupportTicketRepository
from app.domain import Order, OrderState, SupportTicket


def test_saves_and_retrieves_order() -> None:
    repository = InMemoryOrderRepository()
    order = Order(id="order-1", product_ids=["product-1"], amount=100.0)

    saved_order = repository.save(order)
    retrieved_order = repository.get_by_id("order-1")

    assert saved_order == order
    assert retrieved_order == order


def test_returns_none_when_order_does_not_exist() -> None:
    repository = InMemoryOrderRepository()

    assert repository.get_by_id("missing-order") is None


def test_lists_all_orders() -> None:
    repository = InMemoryOrderRepository()
    order_1 = Order(id="order-1", product_ids=["product-1"], amount=100.0)
    order_2 = Order(id="order-2", product_ids=["product-2"], amount=200.0)

    repository.save(order_1)
    repository.save(order_2)

    assert repository.list_all() == [order_1, order_2]


def test_saves_and_retrieves_support_ticket() -> None:
    repository = InMemorySupportTicketRepository()
    ticket = SupportTicket(
        id="ticket-1",
        order_id="order-1",
        reason="Payment failed",
        metadata={"amount": 1200.0},
    )

    saved_ticket = repository.save(ticket)
    retrieved_ticket = repository.get_by_id("ticket-1")

    assert saved_ticket == ticket
    assert retrieved_ticket == ticket


def test_returns_none_when_support_ticket_does_not_exist() -> None:
    repository = InMemorySupportTicketRepository()

    assert repository.get_by_id("missing-ticket") is None


def test_lists_all_support_tickets() -> None:
    repository = InMemorySupportTicketRepository()
    ticket_1 = SupportTicket(
        id="ticket-1",
        order_id="order-1",
        reason="Payment failed",
        metadata={"amount": 1200.0},
    )
    ticket_2 = SupportTicket(
        id="ticket-2",
        order_id="order-2",
        reason="Delivery issue",
        metadata={"carrier": "local"},
    )

    repository.save(ticket_1)
    repository.save(ticket_2)

    assert repository.list_all() == [ticket_1, ticket_2]


def test_lists_support_tickets_by_order_id() -> None:
    repository = InMemorySupportTicketRepository()
    ticket_1 = SupportTicket(
        id="ticket-1",
        order_id="order-1",
        reason="Payment failed",
        metadata={"amount": 1200.0},
    )
    ticket_2 = SupportTicket(
        id="ticket-2",
        order_id="order-1",
        reason="Delivery issue",
        metadata={"carrier": "local"},
    )
    ticket_3 = SupportTicket(
        id="ticket-3",
        order_id="order-2",
        reason="Payment failed",
        metadata={"amount": 1400.0},
    )

    repository.save(ticket_1)
    repository.save(ticket_2)
    repository.save(ticket_3)

    assert repository.list_by_order_id("order-1") == [ticket_1, ticket_2]


def test_returned_order_changes_do_not_mutate_repository_storage() -> None:
    repository = InMemoryOrderRepository()
    order = Order(id="order-1", product_ids=["product-1"], amount=100.0)
    repository.save(order)

    retrieved_order = repository.get_by_id("order-1")
    assert retrieved_order is not None

    retrieved_order.product_ids.append("product-2")
    retrieved_order.current_state = OrderState.CONFIRMED

    stored_order = repository.get_by_id("order-1")

    assert stored_order == order


def test_returned_support_ticket_changes_do_not_mutate_repository_storage() -> None:
    repository = InMemorySupportTicketRepository()
    ticket = SupportTicket(
        id="ticket-1",
        order_id="order-1",
        reason="Payment failed",
        metadata={"amount": 1200.0},
    )
    repository.save(ticket)

    retrieved_ticket = repository.get_by_id("ticket-1")
    assert retrieved_ticket is not None

    retrieved_ticket.reason = "Changed reason"
    retrieved_ticket.metadata["amount"] = 900.0

    stored_ticket = repository.get_by_id("ticket-1")

    assert stored_ticket == ticket
