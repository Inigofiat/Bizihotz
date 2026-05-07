from __future__ import annotations

from fastapi.testclient import TestClient

from app import main as app_main


class _HealthyResponse:
    status_code = 200
    headers = {"content-type": "application/json"}

    @staticmethod
    def json():
        return {"status": "ok"}


class _HealthyAsyncClient:
    async def get(self, url, timeout=None):  # noqa: ARG002
        return _HealthyResponse()

    async def aclose(self) -> None:
        return None


class _DegradedResponse:
    status_code = 503
    headers = {"content-type": "application/json"}

    @staticmethod
    def json():
        return {"status": "degraded"}


class _OneFailingHealthAsyncClient:
    def __init__(self):
        self.calls = 0

    async def get(self, url, timeout=None):  # noqa: ARG002
        self.calls += 1
        if self.calls == 1:
            return _DegradedResponse()
        return _HealthyResponse()

    async def aclose(self) -> None:
        return None


def test_health_exposes_gateway_configuration(monkeypatch):
    async def _skip_openapi_refresh():
        return {}

    monkeypatch.setattr(app_main.aggregator, "refresh", _skip_openapi_refresh)
    monkeypatch.setattr(app_main.httpx, "AsyncClient", lambda *args, **kwargs: _HealthyAsyncClient())

    with TestClient(app_main.app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["gateway"]["port"] == app_main.settings.port
    assert len(payload["gateway"]["services"]) == len(app_main.settings.services)
    assert all(service["ok"] is True for service in payload["gateway"]["services"])


def test_health_reports_degraded_when_any_service_fails(monkeypatch):
    async def _skip_openapi_refresh():
        return {}

    monkeypatch.setattr(app_main.aggregator, "refresh", _skip_openapi_refresh)
    monkeypatch.setattr(app_main.httpx, "AsyncClient", lambda *args, **kwargs: _OneFailingHealthAsyncClient())

    with TestClient(app_main.app) as client:
        response = client.get("/health")

    assert response.status_code == 503
    payload = response.json()
    assert payload["status"] == "degraded"
    assert any(service["ok"] is False for service in payload["gateway"]["services"])
