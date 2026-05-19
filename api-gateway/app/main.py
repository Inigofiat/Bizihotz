from __future__ import annotations

from contextlib import asynccontextmanager
import logging
from urllib.parse import urljoin

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from .config import ServiceConfig, get_settings
from .openapi import OpenAPIAggregator
from .proxy import PROXY_METHODS, proxy_request

logger = logging.getLogger(__name__)

settings = get_settings()
aggregator = OpenAPIAggregator(settings.services)

SWAGGER_HIDE_AUTH_CSS = """
<style>
  .swagger-ui .auth-wrapper,
  .swagger-ui .authorize-wrapper,
  .swagger-ui .opblock .authorization__btn {
    display: none !important;
  }
  .swagger-ui .scheme-container {
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
  }
</style>
"""


@asynccontextmanager
async def lifespan(application: FastAPI):
    application.state.settings = settings
    application.state.http_client = httpx.AsyncClient(
        timeout=settings.request_timeout,
        follow_redirects=True,
    )
    await aggregator.refresh()
    for service in settings.services:
        logger.info("Servicio registrado: %s (%s -> %s)", service.name, service.route, service.target)
    try:
        yield
    finally:
        client: httpx.AsyncClient = application.state.http_client
        await client.aclose()


app = FastAPI(
    title="Bizihotz FastAPI Gateway",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


@app.get("/health")
async def health() -> JSONResponse:
    client: httpx.AsyncClient = app.state.http_client
    service_checks = []
    all_services_ok = True

    for service in settings.services:
        health_url = urljoin(f"{service.target.rstrip('/')}/", "health")
        try:
            response = await client.get(health_url, timeout=settings.request_timeout)
            payload = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            service_status = str(payload.get("status", "")).lower()
            ok = response.status_code == 200 and service_status == "ok"
        except (httpx.HTTPError, ValueError) as exc:
            response = None
            payload = {"detail": str(exc)}
            ok = False

        if not ok:
            all_services_ok = False

        service_checks.append(
            {
                "name": service.name,
                "route": service.route,
                "target": service.target,
                "healthUrl": health_url,
                "ok": ok,
                "statusCode": response.status_code if response else None,
                "upstreamStatus": payload.get("status"),
                "upstream": payload,
                "hasOpenApi": bool(service.openapi_url),
            }
        )

    status = "ok" if all_services_ok else "degraded"
    code = 200 if all_services_ok else 503

    return JSONResponse(
        status_code=code,
        content={
            "status": status,
            "gateway": {
                "port": settings.port,
                "services": service_checks,
            },
        },
    )


@app.get("/docs", include_in_schema=False)
async def custom_docs():
    docs_response = get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="Bizihotz FastAPI Gateway",
        swagger_favicon_url="https://fastapi.tiangolo.com/img/favicon.png",
    )
    html = docs_response.body.decode("utf-8").replace("</head>", f"{SWAGGER_HIDE_AUTH_CSS}</head>")
    return HTMLResponse(content=html)


@app.get("/openapi.json", include_in_schema=False)
async def openapi_documentation():
    return await aggregator.get_spec()


def _register_service_routes(service: ServiceConfig) -> None:
    prefix = service.route.rstrip("/")
    base_path = prefix or "/"
    param_path = f"{prefix}/{{path:path}}" if prefix else "/{path:path}"

    @app.api_route(base_path, methods=PROXY_METHODS, name=f"{service.name}-root")
    async def proxy_root(request: Request, service_config=service):
        return await proxy_request(request, service_config, "")

    @app.api_route(param_path, methods=PROXY_METHODS, name=f"{service.name}-proxy")
    async def proxy_with_path(path: str, request: Request, service_config=service):
        return await proxy_request(request, service_config, path)


for _service in settings.services:
    _register_service_routes(_service)
