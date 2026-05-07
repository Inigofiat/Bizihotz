from __future__ import annotations

import httpx
from fastapi.testclient import TestClient

from app import main as app_main


class _SuccessfulStream:
    def __init__(self, response):
        self._response = response

    async def __aenter__(self) -> httpx.Response:
        return self._response

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


class _FailingStream:
    async def __aenter__(self):
        raise httpx.ConnectError("upstream unavailable")

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


class _RecordingAsyncClient:
    def __init__(self, status_code: int = 200):
        self.status_code = status_code
        self.last_call: dict | None = None

    def stream(self, method, url, content=None, headers=None, cookies=None):
        self.last_call = {
            "method": method,
            "url": url,
            "headers": dict(headers or {}),
            "cookies": dict(cookies or {}),
            "content": content,
        }
        payload = b'{"status":"ok","source":"fake-upstream"}'
        response = _FakeUpstreamResponse(
            status_code=self.status_code,
            payload=payload,
            headers={"content-type": "application/json", "x-upstream": "fake"},
        )
        return _SuccessfulStream(response)

    async def aclose(self) -> None:
        return None


class _FailingAsyncClient:
    def stream(self, method, url, content=None, headers=None, cookies=None):
        return _FailingStream()

    async def aclose(self) -> None:
        return None


class _FakeUpstreamResponse:
    def __init__(self, status_code: int, payload: bytes, headers: dict[str, str]):
        self.status_code = status_code
        self._payload = payload
        self.headers = headers

    async def aiter_raw(self):
        yield self._payload


def _disable_openapi_refresh(monkeypatch):
    async def _skip_openapi_refresh():
        return {}

    monkeypatch.setattr(app_main.aggregator, "refresh", _skip_openapi_refresh)


def _get_service_target(service_name: str) -> str:
    service = next((s for s in app_main.settings.services if s.name == service_name), None)
    assert service is not None, f"Servicio {service_name} no configurado en settings"
    return service.target


def test_proxy_forwards_request_and_returns_upstream_response(monkeypatch):
    _disable_openapi_refresh(monkeypatch)
    recorder = _RecordingAsyncClient()
    monkeypatch.setattr(app_main.httpx, "AsyncClient", lambda *args, **kwargs: recorder)

    gestion_target = _get_service_target("gestion")
    expected_url = f"{gestion_target}/status?trace=1"
    expected_host = httpx.URL(gestion_target).netloc

    with TestClient(app_main.app) as client:
        response = client.get("/gestion/status", params={"trace": "1"})

    assert response.status_code == 200
    assert response.json()["source"] == "fake-upstream"
    assert recorder.last_call is not None
    assert recorder.last_call["method"] == "GET"
    assert recorder.last_call["url"] == expected_url
    assert recorder.last_call["headers"]["x-forwarded-by"] == "bizihotz-fastapi-gateway"
    assert recorder.last_call["headers"]["host"] == expected_host


def test_proxy_returns_502_when_upstream_fails(monkeypatch):
    _disable_openapi_refresh(monkeypatch)
    monkeypatch.setattr(app_main.httpx, "AsyncClient", lambda *args, **kwargs: _FailingAsyncClient())

    with TestClient(app_main.app) as client:
        response = client.get("/gestion/status")

    assert response.status_code == 502
    detail = response.json()["detail"]
    assert "Error al contactar con el servicio gestion" in detail
