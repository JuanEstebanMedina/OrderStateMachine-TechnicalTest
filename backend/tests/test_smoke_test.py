import pytest

from scripts.smoke_test import (
    SMOKE_EVENT,
    SmokeTestFailure,
    build_url,
    normalize_base_url,
    select_smoke_event,
)


def test_normalize_base_url_trims_trailing_slash() -> None:
    assert normalize_base_url(" https://example.com/prod/ ") == "https://example.com/prod"


def test_normalize_base_url_rejects_missing_scheme() -> None:
    with pytest.raises(SmokeTestFailure):
        normalize_base_url("example.com/prod")


def test_build_url_joins_base_url_and_path() -> None:
    assert build_url("https://example.com/prod/", "/health") == "https://example.com/prod/health"


def test_select_smoke_event_requires_known_valid_transition() -> None:
    assert select_smoke_event(["paymentFailed", SMOKE_EVENT]) == SMOKE_EVENT


def test_select_smoke_event_rejects_unexpected_available_events() -> None:
    with pytest.raises(SmokeTestFailure):
        select_smoke_event(["paymentFailed"])
