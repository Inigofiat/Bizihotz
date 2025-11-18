from __future__ import annotations

import logging

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import JSONResponse, RedirectResponse

from .config import ServiceConfig, get_settings
from .openapi import OpenAPIAggregator
from .proxy import PROXY_METHODS, proxy_request

logger = logging.getLogger(__name__)

settings = get_settings()
aggregator = OpenAPIAggregator(settings.services)

app = FastAPI(
    title="Bizihotz FastAPI Gateway",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    app.state.settings = settings
    app.state.http_client = httpx.AsyncClient(
        timeout=settings.request_timeout,
        follow_redirects=True,
    )
    await aggregator.refresh()
    for service in settings.services:
        logger.info("Servicio registrado: %s (%s -> %s)", service.name, service.route, service.target)


@app.on_event("shutdown")
async def _shutdown() -> None:
    client: httpx.AsyncClient = app.state.http_client
    await client.aclose()


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse(
        {
            "status": "ok",
            "gateway": {
                "port": settings.port,
                "services": [
                    {
                        "name": service.name,
                        "route": service.route,
                        "target": service.target,
                        "hasOpenApi": bool(service.openapi_url),
                    }
                    for service in settings.services
                ],
            },
        }
    )


@app.get("/docs", include_in_schema=False)
async def custom_docs():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="Bizihotz FastAPI Gateway",
        swagger_favicon_url="https://fastapi.tiangolo.com/img/favicon.png",
    )


@app.get("/openapi.json", include_in_schema=False)
async def openapi_documentation():
    return await aggregator.get_spec()


def _register_service_routes(service: ServiceConfig) -> None:
    prefix = service.route.rstrip("/")
    base_path = prefix or "/"
    param_path = f"{prefix}/{{path:path}}" if prefix else "/{path:path}"

    @app.api_route(base_path, methods=PROXY_METHODS, name=f"{service.name}-root")
    async def proxy_root(request: Request, svc: ServiceConfig = service):
        return await proxy_request(request, svc, "")

    @app.api_route(param_path, methods=PROXY_METHODS, name=f"{service.name}-proxy")
    async def proxy_with_path(path: str, request: Request, svc: ServiceConfig = service):
        return await proxy_request(request, svc, path)


for _service in settings.services:
    _register_service_routes(_service)
