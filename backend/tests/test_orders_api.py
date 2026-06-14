from collections.abc import Generator
from dataclasses import dataclass
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.adapters import InMemoryOrderRepository, InMemorySupportTicketRepository
from app.dependencies import get_order_service
from app.main import app
from app.services import OrderService, OrderStateMachine


@dataclass
class ApiTestContext:
    client: TestClient
    support_ticket_repository: InMemorySupportTicketRepository


@pytest.fixture
def api_context() -> Generator[ApiTestContext, None, None]:
    order_repository = InMemoryOrderRepository()
    support_ticket_repository = InMemorySupportTicketRepository()
    service = OrderService(
        order_repository=order_repository,
        support_ticket_repository=support_ticket_repository,
        state_machine=OrderStateMachine(),
    )

    app.dependency_overrides[get_order_service] = lambda: service

    with TestClient(app) as client:
        yield ApiTestContext(
            client=client,
            support_ticket_repository=support_ticket_repository,
        )

    app.dependency_overrides.clear()


def create_order(
    client: TestClient,
    amount: float = 1200.5,
) -> dict:
    response = client.post(
        "/orders",
        json={
            "productIds": ["product-1", "product-2"],
            "amount": amount,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_health_endpoint(api_context: ApiTestContext) -> None:
    response = api_context.client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_order(api_context: ApiTestContext) -> None:
    response = api_context.client.post(
        "/orders",
        json={
            "productIds": ["product-1", "product-2"],
            "amount": 1200.5,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert UUID(data["orderId"])
    assert data["productIds"] == ["product-1", "product-2"]
    assert data["amount"] == pytest.approx(1200.5)
    assert data["currentState"] == "Pending"
    assert data["history"] == []
    assert "createdAt" in data
    assert "updatedAt" in data
    assert "product_ids" not in data
    assert "current_state" not in data


def test_list_orders(api_context: ApiTestContext) -> None:
    first_order = create_order(api_context.client)
    second_order = create_order(api_context.client, amount=300.0)

    response = api_context.client.get("/orders")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    order_ids = {order["orderId"] for order in data}
    assert first_order["orderId"] in order_ids
    assert second_order["orderId"] in order_ids


def test_get_existing_order(api_context: ApiTestContext) -> None:
    created_order = create_order(api_context.client)

    response = api_context.client.get(f"/orders/{created_order['orderId']}")

    assert response.status_code == 200
    assert response.json()["orderId"] == created_order["orderId"]


def test_get_unknown_order(api_context: ApiTestContext) -> None:
    unknown_order_id = "11111111-1111-1111-1111-111111111199"

    response = api_context.client.get(f"/orders/{unknown_order_id}")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_get_order_with_invalid_uuid_returns_422(api_context: ApiTestContext) -> None:
    response = api_context.client.get("/orders/not-a-uuid")

    assert response.status_code == 422


def test_apply_valid_event(api_context: ApiTestContext) -> None:
    created_order = create_order(api_context.client)

    response = api_context.client.post(
        f"/orders/{created_order['orderId']}/events",
        json={
            "eventType": "noVerificationNeeded",
            "metadata": {"source": "checkout"},
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["currentState"] == "PendingPayment"
    assert len(data["history"]) == 1
    history_entry = data["history"][0]
    assert history_entry["eventType"] == "noVerificationNeeded"
    assert history_entry["fromState"] == "Pending"
    assert history_entry["toState"] == "PendingPayment"
    assert history_entry["metadata"] == {"source": "checkout"}
    assert "createdAt" in history_entry


def test_apply_invalid_transition_does_not_mutate_order(
    api_context: ApiTestContext,
) -> None:
    created_order = create_order(api_context.client)

    response = api_context.client.post(
        f"/orders/{created_order['orderId']}/events",
        json={
            "eventType": "itemDispatched",
            "metadata": {"carrier": "local"},
        },
    )

    assert response.status_code == 409
    assert "Invalid order transition" in response.json()["detail"]

    get_response = api_context.client.get(f"/orders/{created_order['orderId']}")
    assert get_response.status_code == 200
    data = get_response.json()
    assert data["currentState"] == "Pending"
    assert data["history"] == []


def test_unknown_event_type_returns_422(api_context: ApiTestContext) -> None:
    created_order = create_order(api_context.client)

    response = api_context.client.post(
        f"/orders/{created_order['orderId']}/events",
        json={
            "eventType": "unknownEvent",
            "metadata": {},
        },
    )

    assert response.status_code == 422


def test_apply_event_to_unknown_order_returns_404(
    api_context: ApiTestContext,
) -> None:
    unknown_order_id = "11111111-1111-1111-1111-111111111199"

    response = api_context.client.post(
        f"/orders/{unknown_order_id}/events",
        json={
            "eventType": "noVerificationNeeded",
            "metadata": {},
        },
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_high_value_payment_failure_creates_support_ticket(
    api_context: ApiTestContext,
) -> None:
    created_order = create_order(api_context.client, amount=1200.5)

    response = api_context.client.post(
        f"/orders/{created_order['orderId']}/events",
        json={
            "eventType": "paymentFailed",
            "metadata": {"source": "checkout"},
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["currentState"] == "Cancelled"

    order_id = UUID(data["orderId"])
    tickets = api_context.support_ticket_repository.list_by_order_id(order_id)
    assert len(tickets) == 1
    assert tickets[0].reason == "High-value order payment failed"
