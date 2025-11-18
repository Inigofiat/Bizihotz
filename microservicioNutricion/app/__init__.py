from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from .routes.alimentos import router as alimentos_router
from .routes.dietas import router as dietas_router
from .routes.health import router as health_router
from .routes.recetas import router as recetas_router


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        openapi_url="/openapi.json",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(health_router, tags=["health"])
    application.include_router(alimentos_router, prefix="/api/alimentos", tags=["alimentos"])
    application.include_router(recetas_router, prefix="/api/recetas", tags=["recetas"])
    application.include_router(dietas_router, prefix="/api/dietas", tags=["dietas"])

    @application.on_event("startup")
    def _create_tables() -> None:
        Base.metadata.create_all(bind=engine)

    return application


app = create_app()
