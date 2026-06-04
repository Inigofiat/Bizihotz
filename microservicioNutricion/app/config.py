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
        self.gestion_service_url = os.getenv("GESTION_SERVICE_URL", "")
        self.gestion_service_bearer_token = os.getenv("GESTION_SERVICE_BEARER_TOKEN", "")
        self.validate_paciente_with_gestion = os.getenv(
            "VALIDATE_PACIENTE_WITH_GESTION", "true"
        ).lower() in ("1", "true", "yes", "on")
        try:
            self.gestion_service_timeout = float(os.getenv("GESTION_SERVICE_TIMEOUT", "5"))
        except ValueError:
            self.gestion_service_timeout = 5.0
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
        # Sincronizar automaticamente los alimentos desde BEDCA al arrancar (por defecto true)
        self.bedca_auto_sync = os.getenv("BEDCA_AUTO_SYNC", "true").lower() in ("1", "true", "yes", "on")


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de Settings."""
    return Settings()
