from __future__ import annotations

import httpx
from fastapi.testclient import TestClient

from app import main as app_main


class _ResponseWithBadJson:
    status_code = 200
    headers = {"content-type": "application/json"}

    @staticmethod
    def json():
        raise ValueError("invalid json payload")


class _HealthClientWithJsonError:
    async def get(self, url, timeout=None):  # noqa: ARG002
        return _ResponseWithBadJson()

    async def aclose(self) -> None:
        return None


class _SpecClient:
    async def get(self, url, timeout=None):  # noqa: ARG002
        return _ResponseWithBadJson()

    async def aclose(self) -> None:
        return None


class _SuccessfulStream:
    def __init__(self, response):
        self._response = response

    async def __aenter__(self) -> httpx.Response:
        return self._response

    async def __aexit__(self, exc_type, exc, tb) -> bool:  # noqa: ARG002
        return False


class _FakeUpstreamResponse:
    def __init__(self):
        self.status_code = 200
        self.headers = {"content-type": "application/json"}

    async def aiter_raw(self):
        yield b'{"status":"ok","kind":"root"}'


class _ProxyRootRecordingClient:
    def __init__(self):
        self.calls = []

    async def get(self, url, timeout=None):  # noqa: ARG002
        return _ResponseWithBadJson()

    def stream(self, method, url, content=None, headers=None, cookies=None):  # noqa: ARG002
        self.calls.append({"method": method, "url": url})
        return _SuccessfulStream(_FakeUpstreamResponse())

    async def aclose(self) -> None:
        return None


def _disable_openapi_refresh(monkeypatch):
    async def _skip_openapi_refresh():
        return {}

    monkeypatch.setattr(app_main.aggregator, "refresh", _skip_openapi_refresh)


def test_root_docs_and_openapi_routes(monkeypatch):
    _disable_openapi_refresh(monkeypatch)
    fake_client = _ProxyRootRecordingClient()
    monkeypatch.setattr(app_main.httpx, "AsyncClient", lambda *args, **kwargs: fake_client)

    async def _fake_get_spec():
        return {"openapi": "3.0.3", "paths": {"/gestion/health": {"get": {}}}}

    monkeypatch.setattr(app_main.aggregator, "get_spec", _fake_get_spec)

    with TestClient(app_main.app, follow_redirects=False) as client:
        root = client.get("/")
        assert root.status_code in (302, 307)
        assert root.headers["location"] == "/docs"

        docs = client.get("/docs")
        assert docs.status_code == 200
        assert "swagger" in docs.text.lower()

        openapi_doc = client.get("/openapi.json")
        assert openapi_doc.status_code == 200
        assert "/gestion/health" in openapi_doc.json()["paths"]


def test_health_returns_degraded_on_invalid_upstream_json(monkeypatch):
    _disable_openapi_refresh(monkeypatch)
    monkeypatch.setattr(app_main.httpx, "AsyncClient", lambda *args, **kwargs: _HealthClientWithJsonError())

    with TestClient(app_main.app) as client:
        response = client.get("/health")

    assert response.status_code == 503
    payload = response.json()
    assert payload["status"] == "degraded"
    assert any("invalid json payload" in (service["upstream"].get("detail") or "") for service in payload["gateway"]["services"])


def test_proxy_root_route_forwards_to_service_base_path(monkeypatch):
    _disable_openapi_refresh(monkeypatch)
    fake_client = _ProxyRootRecordingClient()
    monkeypatch.setattr(app_main.httpx, "AsyncClient", lambda *args, **kwargs: fake_client)

    with TestClient(app_main.app) as client:
        response = client.get("/gestion")

    assert response.status_code == 200
    assert response.json()["kind"] == "root"
    assert fake_client.calls
    assert fake_client.calls[0]["method"] == "GET"
    assert fake_client.calls[0]["url"].endswith("/")

