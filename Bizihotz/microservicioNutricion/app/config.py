from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Aplicacion de configuracion centralizada."""

    def __init__(self) -> None:
        self.app_name = os.getenv("APP_NAME", "Microservicio de Nutricion")
        self.app_version = os.getenv("APP_VERSION", "1.0.0")
        self.database_url = os.getenv("DATABASE_URL", "sqlite:///nutricion.db")
        self.external_nutrition_api_base = os.getenv("EXTERNAL_NUTRITION_API_BASE", "")
        self.external_nutrition_api_key = os.getenv("EXTERNAL_NUTRITION_API_KEY", "")
        self.external_nutrition_app_id = os.getenv("EXTERNAL_NUTRITION_APP_ID", "")
        self.notifications_service_url = os.getenv("NOTIFICATIONS_SERVICE_URL", "")
        self.notifications_service_api_key = os.getenv("NOTIFICATIONS_SERVICE_API_KEY", "")
        cors_origins_raw = os.getenv("CORS_ALLOWED_ORIGINS", "")
        self.cors_allowed_origins = [
            origin.strip()
            for origin in cors_origins_raw.split(",")
            if origin.strip()
        ] or ["*"]
        self.export_footer_note = os.getenv(
            "EXPORT_FOOTER_NOTE",
            "Generado por el equipo de nutricion de Bizihotz",
        )


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de Settings."""
    return Settings()
