from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Configuracion centralizada del microservicio documental."""

    def __init__(self) -> None:
        self.app_name = os.getenv("APP_NAME", "Microservicio Documental")
        self.app_version = os.getenv("APP_VERSION", "0.1.0")
        self.database_url = os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg://postgres:postgres@localhost:5440/documental",
        )
        self.cors_allowed_origins = [
            origin.strip()
            for origin in os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",")
            if origin.strip()
        ] or ["*"]
        self.default_page_size = int(os.getenv("DEFAULT_PAGE_SIZE", "20"))
        self.max_page_size = int(os.getenv("MAX_PAGE_SIZE", "100"))


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de Settings."""
    return Settings()
