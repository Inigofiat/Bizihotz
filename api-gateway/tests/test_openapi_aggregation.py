from __future__ import annotations

import asyncio

from app.config import ServiceConfig
from app.openapi import OpenAPIAggregator


class _FakeHttpResponse:
    def __init__(self, payload: dict, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"upstream error {self.status_code}")

    def json(self) -> dict:
        return self._payload


class _FakeAsyncClient:
    def __init__(self, mapping: dict[str, dict]):
        self._mapping = mapping

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):  # noqa: ARG002
        return False

    async def get(self, url: str):
        payload = self._mapping.get(url)
        if payload is None:
            return _FakeHttpResponse({}, status_code=404)
        return _FakeHttpResponse(payload, status_code=200)


def _run(coro):
    return asyncio.run(coro)


def test_openapi_aggregator_builds_prefixed_spec_from_http_sources(monkeypatch):
    service_specs = {
        "http://gestion:4100/openapi.json": {
            "paths": {
                "/health": {"get": {"summary": "Health A"}},
                "/items": {"get": {"summary": "Items A"}},
            },
            "components": {
                "schemas": {
                    "Shared": {"type": "object", "properties": {"a": {"type": "string"}}},
                    "OnlyA": {"type": "object"},
                },
                "securitySchemes": {"BearerAuth": {"type": "http", "scheme": "bearer"}},
            },
        },
        "http://nutricion:4400/openapi.json": {
            "paths": {
                "/health": {"get": {"summary": "Health B"}},
                "/items": {"post": {"summary": "Items B create"}},
            },
            "components": {
                "schemas": {
                    "Shared": {"type": "object", "properties": {"b": {"type": "number"}}},
                    "OnlyB": {"type": "object"},
                }
            },
        },
    }
    monkeypatch.setattr(
        "app.openapi.httpx.AsyncClient",
        lambda timeout: _FakeAsyncClient(service_specs),  # noqa: ARG005
    )

    services = [
        ServiceConfig(
            name="gestion",
            route="/gestion",
            target="http://gestion:4100",
            openapi_url="http://gestion:4100/openapi.json",
        ),
        ServiceConfig(
            name="nutricion",
            route="/nutricion",
            target="http://nutricion:4400",
            openapi_url="http://nutricion:4400/openapi.json",
        ),
        ServiceConfig(name="sin-openapi", route="/otro", target="http://otro:9999", openapi_url=None),
    ]

    aggregator = OpenAPIAggregator(services, cache_ttl=60.0)
    merged = _run(aggregator.refresh())

    assert "/gestion/health" in merged["paths"]
    assert "/nutricion/health" in merged["paths"]
    assert merged["paths"]["/gestion/items"]["get"]["summary"] == "Items A"
    assert merged["paths"]["/nutricion/items"]["post"]["summary"] == "Items B create"

    shared_schema = merged["components"]["schemas"]["Shared"]
    assert shared_schema["properties"]["a"]["type"] == "string"
    assert shared_schema["properties"]["b"]["type"] == "number"
    assert "BearerAuth" in merged["components"]["securitySchemes"]
    assert "x-generated-at" in merged


def test_openapi_aggregator_uses_cache_when_spec_is_fresh(monkeypatch):
    payload = {"paths": {"/ping": {"get": {"summary": "Ping"}}}}
    spec_url = "http://documentos:4500/openapi.json"
    monkeypatch.setattr(
        "app.openapi.httpx.AsyncClient",
        lambda timeout: _FakeAsyncClient({spec_url: payload}),  # noqa: ARG005
    )

    service = ServiceConfig(
        name="documentos",
        route="/documentos",
        target="http://documentos:4500",
        openapi_url=spec_url,
    )
    aggregator = OpenAPIAggregator([service], cache_ttl=120.0)

    first = _run(aggregator.refresh())

    async def _boom():
        raise AssertionError("No deberia reconstruir estando cacheado")

    aggregator._build = _boom  # type: ignore[method-assign]
    second = _run(aggregator.get_spec())

    assert second is first

