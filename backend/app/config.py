import os


DEFAULT_CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
DEFAULT_PERSISTENCE_BACKEND = "memory"
DEFAULT_DYNAMODB_TABLE_NAME = "OrderStateMachine"
DEFAULT_AWS_REGION = "us-east-1"
DEFAULT_API_GATEWAY_BASE_PATH = ""


def get_cors_allowed_origins() -> list[str]:
    configured_origins = os.getenv("CORS_ALLOWED_ORIGINS")
    if configured_origins is None:
        return DEFAULT_CORS_ALLOWED_ORIGINS.copy()

    origins = [
        origin.strip()
        for origin in configured_origins.split(",")
        if origin.strip()
    ]

    return origins or DEFAULT_CORS_ALLOWED_ORIGINS.copy()


def get_persistence_backend() -> str:
    backend = os.getenv("PERSISTENCE_BACKEND", DEFAULT_PERSISTENCE_BACKEND).strip()
    if backend not in {"memory", "dynamodb"}:
        raise ValueError("PERSISTENCE_BACKEND must be 'memory' or 'dynamodb'")
    return backend


def get_dynamodb_table_name() -> str:
    table_name = os.getenv("DYNAMODB_TABLE_NAME", DEFAULT_DYNAMODB_TABLE_NAME).strip()
    if not table_name:
        raise ValueError("DYNAMODB_TABLE_NAME must not be empty")
    return table_name


def get_dynamodb_endpoint_url() -> str | None:
    endpoint_url = os.getenv("DYNAMODB_ENDPOINT_URL")
    if endpoint_url is None:
        return None

    normalized_endpoint_url = endpoint_url.strip()
    return normalized_endpoint_url or None


def get_aws_region() -> str:
    region = os.getenv("AWS_REGION", DEFAULT_AWS_REGION).strip()
    if not region:
        raise ValueError("AWS_REGION must not be empty")
    return region


def normalize_api_gateway_base_path(base_path: str | None) -> str:
    if base_path is None:
        return DEFAULT_API_GATEWAY_BASE_PATH

    path_segments = [
        segment
        for segment in base_path.strip().split("/")
        if segment
    ]
    if not path_segments:
        return DEFAULT_API_GATEWAY_BASE_PATH

    return f"/{'/'.join(path_segments)}"


def get_api_gateway_base_path() -> str:
    return normalize_api_gateway_base_path(os.getenv("API_GATEWAY_BASE_PATH"))
