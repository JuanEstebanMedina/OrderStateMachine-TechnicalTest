from collections.abc import Generator
from dataclasses import dataclass
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.adapters import InMemoryOrderRepository, InMemorySupportTicketRepository
from app.dependencies import get_order_service, get_state_machine
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
    state_machine = OrderStateMachine()
    service = OrderService(
        order_repository=order_repository,
        support_ticket_repository=support_ticket_repository,
        state_machine=state_machine,
    )

    app.dependency_overrides[get_order_service] = lambda: service
    app.dependency_overrides[get_state_machine] = lambda: state_machine

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


def apply_event(
    client: TestClient,
    order_id: str,
    event_type: str,
) -> dict:
    response = client.post(
        f"/orders/{order_id}/events",
        json={
            "eventType": event_type,
            "metadata": {},
        },
    )
    assert response.status_code == 200
    return response.json()


def test_health_endpoint(api_context: ApiTestContext) -> None:
    response = api_context.client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cors_preflight_allows_configured_local_frontend(
    api_context: ApiTestContext,
) -> None:
    response = api_context.client.options(
        "/orders",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "Content-Type" in response.headers["access-control-allow-headers"]


def test_cors_preflight_does_not_allow_unconfigured_origin(
    api_context: ApiTestContext,
) -> None:
    response = api_context.client.options(
        "/orders",
        headers={
            "Origin": "https://unconfigured.example.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert "access-control-allow-origin" not in response.headers


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
    assert all("history" not in order for order in data)


def test_get_existing_order(api_context: ApiTestContext) -> None:
    created_order = create_order(api_context.client)

    response = api_context.client.get(f"/orders/{created_order['orderId']}")

    assert response.status_code == 200
    assert response.json()["orderId"] == created_order["orderId"]
    assert "history" in response.json()


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


def test_create_and_apply_events_return_detailed_orders(
    api_context: ApiTestContext,
) -> None:
    created_order = create_order(api_context.client)
    updated_order = apply_event(
        api_context.client,
        created_order["orderId"],
        "noVerificationNeeded",
    )

    assert "history" in created_order
    assert "history" in updated_order
    assert len(updated_order["history"]) == 1


def test_available_events_for_new_order(api_context: ApiTestContext) -> None:
    created_order = create_order(api_context.client)

    response = api_context.client.get(
        f"/orders/{created_order['orderId']}/available-events"
    )

    assert response.status_code == 200
    assert response.json() == {
        "events": [
            "pendingBiometricalVerification",
            "noVerificationNeeded",
            "paymentFailed",
            "orderCancelled",
            "orderCancelledByUser",
        ]
    }


def test_available_events_change_after_transition(
    api_context: ApiTestContext,
) -> None:
    created_order = create_order(api_context.client)
    apply_event(
        api_context.client,
        created_order["orderId"],
        "noVerificationNeeded",
    )

    response = api_context.client.get(
        f"/orders/{created_order['orderId']}/available-events"
    )

    assert response.status_code == 200
    assert response.json() == {
        "events": ["orderCancelledByUser", "paymentSuccessful"]
    }


def test_available_events_for_terminal_order_are_empty(
    api_context: ApiTestContext,
) -> None:
    created_order = create_order(api_context.client)
    updated_order = apply_event(
        api_context.client,
        created_order["orderId"],
        "paymentFailed",
    )

    response = api_context.client.get(
        f"/orders/{updated_order['orderId']}/available-events"
    )

    assert response.status_code == 200
    assert response.json() == {"events": []}


def test_available_events_for_unknown_order_returns_404(
    api_context: ApiTestContext,
) -> None:
    unknown_order_id = "11111111-1111-1111-1111-111111111199"

    response = api_context.client.get(f"/orders/{unknown_order_id}/available-events")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_available_events_with_invalid_uuid_returns_422(
    api_context: ApiTestContext,
) -> None:
    response = api_context.client.get("/orders/not-a-uuid/available-events")

    assert response.status_code == 422


def test_state_machine_definition(api_context: ApiTestContext) -> None:
    response = api_context.client.get("/state-machine")

    assert response.status_code == 200
    data = response.json()
    transitions = data["transitions"]
    assert data["initialState"] == "Pending"
    assert data["states"] == [
        "Pending",
        "OnHold",
        "PendingPayment",
        "Confirmed",
        "Processing",
        "Shipped",
        "Delivered",
        "Returning",
        "Returned",
        "Refunded",
        "Cancelled",
    ]
    assert {
        "fromState": "Pending",
        "eventType": "noVerificationNeeded",
        "toState": "PendingPayment",
    } in transitions
    assert {
        "fromState": "Shipped",
        "eventType": "orderCancelledByUser",
        "toState": "Cancelled",
    } in transitions
    assert {
        "fromState": "Cancelled",
        "eventType": "noVerificationNeeded",
        "toState": "PendingPayment",
    } not in transitions
    assert not any(transition["eventType"] == "init" for transition in transitions)


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
