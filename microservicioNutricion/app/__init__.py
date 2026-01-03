from __future__ import annotations

import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine, session_scope
from .routes.alimentos import router as alimentos_router
from .routes.dietas import router as dietas_router
from .routes.health import router as health_router
from .routes.recetas import router as recetas_router
from .services.bedca import sync_bedca_alimentos


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        openapi_url="/openapi.json",
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

    @application.on_event("startup")
    async def _create_tables() -> None:
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

    return application


app = create_app()
