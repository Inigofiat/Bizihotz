from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

import pytest

ROOT_DIR = Path(__file__).resolve().parents[2]
RUN_E2E_ENV = "RUN_COMPOSE_E2E"
KEEP_STACK_ENV = "KEEP_COMPOSE_UP"
BOOT_TIMEOUT_SECONDS = int(os.getenv("COMPOSE_BOOT_TIMEOUT", "300"))
POLL_INTERVAL_SECONDS = 5

HEALTH_ENDPOINTS = {
    "api-gateway": "http://localhost:5000/health",
    "gestion": "http://localhost:4002/health",
    "comunicacion": "http://localhost:4103/health",
    "nutricion": "http://localhost:5002/health",
    "documental": "http://localhost:5100/health",
    "chatbot": "http://localhost:4701/health",
}

GATEWAY_PROXY_ENDPOINTS = {
    "gateway->gestion": "http://localhost:5000/gestion/health",
    "gateway->nutricion": "http://localhost:5000/nutricion/health",
    "gateway->comunicacion": "http://localhost:5000/comunicacion/health",
    "gateway->documental": "http://localhost:5000/documentos/health",
    "gateway->chatbot": "http://localhost:5000/chatbot/health",
}

FRONTEND_ENDPOINTS = {
    "frontend-root": "http://localhost:8080/",
    "frontend-cargando": "http://localhost:8080/pages/cargando.html",
}


def _http_get(url: str) -> tuple[int, dict]:
    with urlopen(url, timeout=5) as response:
        raw = response.read().decode("utf-8")
        content_type = (response.headers.get("content-type") or "").lower()
        if "application/json" in content_type and raw:
            return int(response.status), json.loads(raw)
        return int(response.status), {"raw": raw}


def _wait_for_status_ok(name: str, url: str) -> None:
    deadline = time.time() + BOOT_TIMEOUT_SECONDS
    last_error = ""

    while time.time() < deadline:
        try:
            status_code, payload = _http_get(url)
            status_value = str(payload.get("status", "")).lower()
            if status_code == 200 and status_value == "ok":
                return
            last_error = f"status={status_code}, payload={payload}"
        except (URLError, HTTPError, TimeoutError, ValueError) as exc:
            last_error = str(exc)

        time.sleep(POLL_INTERVAL_SECONDS)

    raise AssertionError(
        f"No se obtuvo health OK para {name} en {url} tras {BOOT_TIMEOUT_SECONDS}s. "
        f"Ultimo error: {last_error}"
    )


def _wait_for_http_200(name: str, url: str) -> None:
    deadline = time.time() + BOOT_TIMEOUT_SECONDS
    last_error = ""

    while time.time() < deadline:
        try:
            status_code, payload = _http_get(url)
            if status_code == 200:
                return
            last_error = f"status={status_code}, payload={payload}"
        except (URLError, HTTPError, TimeoutError, ValueError) as exc:
            last_error = str(exc)

        time.sleep(POLL_INTERVAL_SECONDS)

    raise AssertionError(
        f"No se obtuvo HTTP 200 para {name} en {url} tras {BOOT_TIMEOUT_SECONDS}s. "
        f"Ultimo error: {last_error}"
    )


@pytest.mark.e2e
def test_compose_stack_health_and_gateway_proxy():
    if os.getenv(RUN_E2E_ENV) != "1":
        pytest.skip(f"Definir {RUN_E2E_ENV}=1 para ejecutar esta prueba e2e con Docker Compose")

    subprocess.run(["docker", "compose", "up", "-d", "--build"], cwd=ROOT_DIR, check=True)

    try:
        for service_name, health_url in HEALTH_ENDPOINTS.items():
            _wait_for_status_ok(service_name, health_url)

        for check_name, proxy_url in GATEWAY_PROXY_ENDPOINTS.items():
            _wait_for_http_200(check_name, proxy_url)

        for check_name, frontend_url in FRONTEND_ENDPOINTS.items():
            _wait_for_http_200(check_name, frontend_url)
    finally:
        subprocess.run(["docker", "compose", "ps"], cwd=ROOT_DIR, check=False)
        if os.getenv(KEEP_STACK_ENV) != "1":
            subprocess.run(["docker", "compose", "down"], cwd=ROOT_DIR, check=False)
