from app import lambda_handler


def test_lambda_handler_exports_callable_handler() -> None:
    assert callable(lambda_handler.handler)


def test_safe_api_context_keeps_only_request_identity_fields() -> None:
    event = {
        "routeKey": "GET /orders",
        "headers": {
            "authorization": "Bearer secret",
            "x-api-key": "secret",
        },
        "body": '{"metadata":{"secret":"value"}}',
        "metadata": {"secret": "value"},
        "requestContext": {
            "requestId": "api-request-id",
            "authorizer": {"jwt": {"claims": {"sub": "user"}}},
            "http": {
                "method": "GET",
                "path": "/orders",
                "sourceIp": "203.0.113.10",
                "userAgent": "unit-test",
            },
        },
    }

    assert lambda_handler._safe_api_context(event) == {
        "api_request_id": "api-request-id",
        "api_route_key": "GET /orders",
        "http_method": "GET",
    }


def test_safe_api_context_ignores_missing_request_context() -> None:
    assert lambda_handler._safe_api_context({"headers": {"authorization": "secret"}}) == {}
