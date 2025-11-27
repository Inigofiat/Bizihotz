from __future__ import annotations

import asyncio
import json
import logging
import time
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

import httpx

from .config import ServiceConfig

logger = logging.getLogger(__name__)

BASE_SPEC: Dict[str, Any] = {
    "openapi": "3.0.3",
    "info": {
        "title": "Bizihotz FastAPI Gateway",
        "version": "1.0.0",
        "description": "Documentación agregada dinámicamente a partir de los microservicios activos.",
    },
    "servers": [
        {
            "url": "/",
            "description": "API Gateway",
        }
    ],
    "paths": {},
    "components": {},
}


class OpenAPIAggregator:
    """Recoge y cachea las especificaciones OpenAPI de los microservicios."""

    def __init__(
        self,
        services: Iterable[ServiceConfig],
        timeout: float = 5.0,
        cache_ttl: float = 30.0,
    ) -> None:
        self._services = list(services)
        self._timeout = timeout
        self._cache_ttl = cache_ttl
        self._cache: Optional[Dict[str, Any]] = None
        self._cache_at: float = 0.0
        self._lock = asyncio.Lock()

    async def get_spec(self) -> Dict[str, Any]:
        async with self._lock:
            if self._cache and (time.time() - self._cache_at) < self._cache_ttl:
                return self._cache
        return await self.refresh()

    async def refresh(self) -> Dict[str, Any]:
        async with self._lock:
            self._cache = await self._build()
            self._cache_at = time.time()
            return self._cache

    async def _build(self) -> Dict[str, Any]:
        aggregated = deepcopy(BASE_SPEC)
        aggregated["x-generated-at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            for service in self._services:
                spec = await self._load_spec(client, service)
                if not spec:
                    continue
                self._merge_spec(aggregated, spec, service.route)

        return aggregated

    async def _load_spec(
        self,
        client: httpx.AsyncClient,
        service: ServiceConfig,
    ) -> Optional[Dict[str, Any]]:
        if not service.openapi_url:
            return None

        try:
            if service.openapi_url.startswith("file:"):
                path = Path(service.openapi_url.replace("file:", "")).expanduser()
                return json.loads(path.read_text(encoding="utf-8"))

            response = await client.get(service.openapi_url)
            response.raise_for_status()
            return response.json()
        except Exception as exc:  # pragma: no cover - dependemos de servicios externos
            logger.warning(
                "No se pudo cargar la especificación de %s (%s): %s",
                service.name,
                service.openapi_url,
                exc,
            )
            return None

    def _merge_spec(self, aggregated: Dict[str, Any], spec: Dict[str, Any], prefix: str) -> None:
        formatted_prefix = prefix.rstrip("/") or ""
        paths = spec.get("paths") or {}
        aggregated.setdefault("paths", {})

        for path_key, path_value in paths.items():
            prefixed = f"{formatted_prefix}{path_key}"
            if prefixed not in aggregated["paths"]:
                aggregated["paths"][prefixed] = path_value
            else:
                aggregated["paths"][prefixed] = {
                    **aggregated["paths"][prefixed],
                    **path_value,
                }

        components = spec.get("components")
        if components:
            aggregated.setdefault("components", {})
            self._merge_objects(aggregated["components"], components)

    def _merge_objects(self, target: Dict[str, Any], source: Dict[str, Any]) -> None:
        for key, value in source.items():
            if value is None:
                continue

            existing = target.get(key)
            if isinstance(value, dict):
                if existing is None:
                    target[key] = deepcopy(value)
                else:
                    self._merge_objects(existing, value)
                continue

            if existing is None:
                target[key] = value
