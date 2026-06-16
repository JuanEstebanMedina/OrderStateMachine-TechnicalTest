import os
from typing import Any

from aws_lambda_powertools import Logger, Metrics, Tracer
from aws_lambda_powertools.metrics import MetricUnit
from mangum import Mangum

from app.config import get_api_gateway_base_path
from app.main import create_app


SERVICE_NAME = os.getenv("POWERTOOLS_SERVICE_NAME", "order-state-machine-api")
METRICS_NAMESPACE = os.getenv("POWERTOOLS_METRICS_NAMESPACE", "OrderStateMachine")
API_GATEWAY_BASE_PATH = get_api_gateway_base_path()

logger = Logger(service=SERVICE_NAME)
tracer = Tracer(service=SERVICE_NAME)
metrics = Metrics(namespace=METRICS_NAMESPACE, service=SERVICE_NAME)
app = create_app(root_path=API_GATEWAY_BASE_PATH)
asgi_handler = Mangum(
    app,
    lifespan="off",
    api_gateway_base_path=API_GATEWAY_BASE_PATH or "/",
)


def _safe_api_context(event: dict[str, Any]) -> dict[str, Any]:
    request_context = event.get("requestContext")
    if not isinstance(request_context, dict):
        return {}

    http_context = request_context.get("http")
    if not isinstance(http_context, dict):
        http_context = {}

    context = {
        "api_request_id": request_context.get("requestId"),
        "api_route_key": event.get("routeKey"),
        "http_method": http_context.get("method"),
    }
    return {key: value for key, value in context.items() if value is not None}


@logger.inject_lambda_context(log_event=False, clear_state=True)
@tracer.capture_lambda_handler
@metrics.log_metrics(capture_cold_start_metric=True)
def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    safe_context = _safe_api_context(event)
    if safe_context:
        logger.append_keys(**safe_context)

    metrics.add_metric(name="ApiGatewayRequest", unit=MetricUnit.Count, value=1)
    return asgi_handler(event, context)
