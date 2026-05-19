from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from .config import get_settings
from .database import Base, engine, session_scope
from .routes.alimentos import router as alimentos_router
from .routes.dietas import router as dietas_router
from .routes.health import router as health_router
from .routes.recetas import router as recetas_router
from .services.bedca import sync_bedca_alimentos


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        Base.metadata.create_all(bind=engine)

        if settings.bedca_auto_sync:

            async def _run_bedca_sync() -> None:
                def _sync_job() -> None:
                    with session_scope() as session:
                        sync_bedca_alimentos(session)

                try:
                    await asyncio.to_thread(_sync_job)
                    print("[BEDCA] Sincronizacion inicial completada.")
                except Exception as exc:  # pragma: no cover - best effort log
                    print(f"[BEDCA] Error al sincronizar al arrancar: {exc}")

            asyncio.create_task(_run_bedca_sync())

        yield

    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(health_router, tags=["health"])
    application.include_router(alimentos_router, prefix="/api/alimentos", tags=["alimentos"])
    application.include_router(recetas_router, prefix="/api/recetas", tags=["recetas"])
    application.include_router(dietas_router, prefix="/api/dietas", tags=["dietas"])

    def custom_openapi():
        if application.openapi_schema:
            return application.openapi_schema

        openapi_schema = get_openapi(
            title=application.title,
            version=application.version,
            description=application.description,
            routes=application.routes,
        )
        components = openapi_schema.setdefault("components", {})
        security_schemes = components.setdefault("securitySchemes", {})
        security_schemes["BearerAuth"] = {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
        openapi_schema["security"] = [{"BearerAuth": []}]

        health_get = openapi_schema.get("paths", {}).get("/health", {}).get("get")
        if isinstance(health_get, dict):
            health_get["security"] = []

        application.openapi_schema = openapi_schema
        return application.openapi_schema

    application.openapi = custom_openapi

    return application


app = create_app()
