from fastapi.testclient import TestClient
import pytest

from app.config import normalize_api_gateway_base_path
from app.main import create_app


def test_local_docs_reference_local_openapi_url() -> None:
    client = TestClient(create_app())

    response = client.get("/docs")

    assert response.status_code == 200
    assert "url: '/openapi.json'" in response.text


def test_staged_docs_reference_stage_prefixed_openapi_url() -> None:
    client = TestClient(create_app(root_path="/prod"))

    response = client.get("/docs")

    assert response.status_code == 200
    assert "url: '/prod/openapi.json'" in response.text


@pytest.mark.parametrize(
    ("configured_path", "expected_path"),
    [
        ("", ""),
        ("/", ""),
        ("prod", "/prod"),
        ("/prod", "/prod"),
        ("/prod/", "/prod"),
        ("//prod//", "/prod"),
    ],
)
def test_api_gateway_base_path_normalization(
    configured_path: str,
    expected_path: str,
) -> None:
    assert normalize_api_gateway_base_path(configured_path) == expected_path
