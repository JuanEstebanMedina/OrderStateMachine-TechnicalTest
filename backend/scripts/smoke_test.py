from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
import sys
from typing import Any
from urllib import error, request
from uuid import uuid4


SMOKE_EVENT = "noVerificationNeeded"
EXPECTED_INITIAL_STATE = "Pending"
EXPECTED_STATE_AFTER_SMOKE_EVENT = "PendingPayment"
CREATE_ORDER_STEP = "create order"
RETRIEVE_CREATED_ORDER_STEP = "retrieve created order"
RETRIEVE_UPDATED_ORDER_STEP = "retrieve updated order"


class SmokeTestFailure(Exception):
    pass


@dataclass(frozen=True)
class JsonResponse:
    status: int
    body: Any


def normalize_base_url(base_url: str) -> str:
    normalized = base_url.strip().rstrip("/")
    if not normalized:
        raise SmokeTestFailure("--base-url must not be empty")
    if not normalized.startswith(("http://", "https://")):
        raise SmokeTestFailure("--base-url must start with http:// or https://")
    return normalized


def build_url(base_url: str, path: str) -> str:
    return f"{normalize_base_url(base_url)}/{path.lstrip('/')}"


def request_json(
    base_url: str,
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
) -> JsonResponse:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"

    http_request = request.Request(
        build_url(base_url, path),
        data=body,
        headers=headers,
        method=method,
    )

    try:
        with request.urlopen(http_request, timeout=15) as response:
            response_body = response.read().decode("utf-8")
            return JsonResponse(
                status=response.status,
                body=json.loads(response_body) if response_body else None,
            )
    except error.HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        raise SmokeTestFailure(
            f"{method} {path} returned HTTP {exc.code}: {response_body[:500]}"
        ) from exc
    except error.URLError as exc:
        raise SmokeTestFailure(f"{method} {path} failed: {exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise SmokeTestFailure(f"{method} {path} returned invalid JSON") from exc


def require_status(response: JsonResponse, expected_status: int, step: str) -> None:
    if response.status != expected_status:
        raise SmokeTestFailure(
            f"{step} returned HTTP {response.status}; expected {expected_status}"
        )


def require_object(value: Any, step: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise SmokeTestFailure(f"{step} returned {type(value).__name__}; expected object")
    return value


def require_string(payload: dict[str, Any], field_name: str, step: str) -> str:
    value = payload.get(field_name)
    if not isinstance(value, str) or not value:
        raise SmokeTestFailure(f"{step} missing string field {field_name!r}")
    return value


def require_list(payload: dict[str, Any], field_name: str, step: str) -> list[Any]:
    value = payload.get(field_name)
    if not isinstance(value, list):
        raise SmokeTestFailure(f"{step} missing list field {field_name!r}")
    return value


def select_smoke_event(events: list[Any]) -> str:
    if SMOKE_EVENT not in events:
        raise SmokeTestFailure(
            f"created order did not expose required smoke event {SMOKE_EVENT!r}"
        )
    return SMOKE_EVENT


def assert_order_state(order: dict[str, Any], expected_state: str, step: str) -> None:
    current_state = order.get("currentState")
    if current_state != expected_state:
        raise SmokeTestFailure(
            f"{step} has state {current_state!r}; expected {expected_state!r}"
        )


def run_smoke_test(base_url: str) -> str:
    run_id = uuid4().hex

    health_response = request_json(base_url, "GET", "/health")
    require_status(health_response, 200, "health check")
    health_payload = require_object(health_response.body, "health check")
    if health_payload.get("status") != "ok":
        raise SmokeTestFailure("health check did not return status='ok'")

    openapi_response = request_json(base_url, "GET", "/openapi.json")
    require_status(openapi_response, 200, "retrieve OpenAPI document")
    openapi_payload = require_object(
        openapi_response.body,
        "retrieve OpenAPI document",
    )
    require_string(openapi_payload, "openapi", "retrieve OpenAPI document")

    create_response = request_json(
        base_url,
        "POST",
        "/orders",
        {
            "productIds": [f"smoke-{run_id}"],
            "amount": 42.5,
        },
    )
    require_status(create_response, 201, CREATE_ORDER_STEP)
    created_order = require_object(create_response.body, CREATE_ORDER_STEP)
    order_id = require_string(created_order, "orderId", CREATE_ORDER_STEP)
    assert_order_state(created_order, EXPECTED_INITIAL_STATE, "created order")

    get_created_response = request_json(base_url, "GET", f"/orders/{order_id}")
    require_status(get_created_response, 200, RETRIEVE_CREATED_ORDER_STEP)
    retrieved_order = require_object(
        get_created_response.body,
        RETRIEVE_CREATED_ORDER_STEP,
    )
    if retrieved_order.get("orderId") != order_id:
        raise SmokeTestFailure("retrieved order ID did not match created order")
    assert_order_state(retrieved_order, EXPECTED_INITIAL_STATE, "retrieved order")
    initial_history = require_list(
        retrieved_order,
        "history",
        RETRIEVE_CREATED_ORDER_STEP,
    )
    if initial_history:
        raise SmokeTestFailure("new order unexpectedly has transition history")

    events_response = request_json(
        base_url,
        "GET",
        f"/orders/{order_id}/available-events",
    )
    require_status(events_response, 200, "retrieve available events")
    events_payload = require_object(events_response.body, "retrieve available events")
    event_type = select_smoke_event(require_list(events_payload, "events", "events"))

    update_response = request_json(
        base_url,
        "POST",
        f"/orders/{order_id}/events",
        {
            "eventType": event_type,
            "metadata": {"source": "smoke-test", "runId": run_id},
        },
    )
    require_status(update_response, 200, "apply event")
    updated_order = require_object(update_response.body, "apply event")
    assert_order_state(
        updated_order,
        EXPECTED_STATE_AFTER_SMOKE_EVENT,
        "updated order",
    )

    get_updated_response = request_json(base_url, "GET", f"/orders/{order_id}")
    require_status(get_updated_response, 200, RETRIEVE_UPDATED_ORDER_STEP)
    persisted_order = require_object(
        get_updated_response.body,
        RETRIEVE_UPDATED_ORDER_STEP,
    )
    assert_order_state(
        persisted_order,
        EXPECTED_STATE_AFTER_SMOKE_EVENT,
        "persisted order",
    )
    history = require_list(persisted_order, "history", RETRIEVE_UPDATED_ORDER_STEP)
    if len(history) != 1:
        raise SmokeTestFailure(f"persisted order history length is {len(history)}; expected 1")

    history_entry = require_object(history[0], "persisted history entry")
    expected_history = {
        "eventType": event_type,
        "fromState": EXPECTED_INITIAL_STATE,
        "toState": EXPECTED_STATE_AFTER_SMOKE_EVENT,
    }
    for field_name, expected_value in expected_history.items():
        if history_entry.get(field_name) != expected_value:
            raise SmokeTestFailure(
                f"history field {field_name!r} is {history_entry.get(field_name)!r}; "
                f"expected {expected_value!r}"
            )

    return (
        f"Smoke test succeeded for order {order_id}: "
        f"{EXPECTED_INITIAL_STATE} -> {EXPECTED_STATE_AFTER_SMOKE_EVENT} "
        f"via {event_type}; history entries={len(history)}"
    )


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a deployed API smoke test.")
    parser.add_argument("--base-url", required=True, help="API Gateway base URL")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    try:
        print(run_smoke_test(args.base_url))
    except SmokeTestFailure as exc:
        print(f"Smoke test failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
