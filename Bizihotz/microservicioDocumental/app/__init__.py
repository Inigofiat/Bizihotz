from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from .routes.documentos import router as documentos_router
from .routes.health import router as health_router


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        openapi_url="/openapi.json",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(health_router, tags=["health"])
    application.include_router(documentos_router, tags=["documentos"])

    @application.on_event("startup")
    def _create_tables() -> None:
        Base.metadata.create_all(bind=engine)

    return application


app = create_app()
