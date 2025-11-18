from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import List, Optional


@dataclass
class ServiceConfig:
    """Configuración de un microservicio proxied por el gateway."""

    name: str
    route: str
    target: str
    openapi_url: Optional[str] = None


@dataclass
class Settings:
    """Configuración general del gateway."""

    port: int
    services: List[ServiceConfig]
    request_timeout: float = 10.0


_SERVICE_DEFAULTS = [
    ("GESTION", "/gestion"),
    ("NUTRICION", "/nutricion"),
    ("COMUNICACION", "/comunicacion"),
    ("DOCUMENTOS", "/documentos"),
]


def _normalize_url(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return value.rstrip("/")


def _build_service(env: dict[str, str], key: str, route: str) -> Optional[ServiceConfig]:
    target = _normalize_url(env.get(f"{key}_SERVICE_URL"))
    if not target:
        return None

    openapi_url = env.get(f"{key}_OPENAPI_URL")
    if openapi_url:
        openapi_url = openapi_url.strip()

    normalized_route = route if route.startswith("/") else f"/{route}"
    normalized_route = normalized_route.rstrip("/") or "/"

    return ServiceConfig(
        name=key.lower(),
        route=normalized_route,
        target=target,
        openapi_url=openapi_url or None,
    )


@lru_cache()
def get_settings() -> Settings:
    env = dict(os.environ)
    port = int(env.get("PORT", "5000") or "5000")
    timeout = float(env.get("GATEWAY_TIMEOUT", "10"))

    services: List[ServiceConfig] = []
    for key, route in _SERVICE_DEFAULTS:
        service = _build_service(env, key, route)
        if service:
            services.append(service)

    return Settings(port=port, services=services, request_timeout=timeout)
