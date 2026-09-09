from fastapi.testclient import TestClient

from app.main import app, client
from app.mistral_client import MistralError


def test_app_starts_and_exposes_config():
    response = TestClient(app).get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert data["model"] == client.model
    assert data["min_interval_seconds"] >= 0
    assert data["max_retries"] >= 0


def test_mistral_error_keeps_upstream_diagnostics():
    error = MistralError(
        "rate limited",
        status_code=429,
        request_id="request-123",
        rate_limit_headers={"Retry-After": "1"},
    )
    assert error.status_code == 429
    assert error.request_id == "request-123"
    assert error.rate_limit_headers["Retry-After"] == "1"
