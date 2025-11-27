from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Configuración centralizada del microservicio documental."""

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
        # Fuentes activas separados por coma, ej: "openlibrary"
        self.enabled_sources = [
            source.strip()
            for source in os.getenv("ENABLED_SOURCES", "openlibrary").split(",")
            if source.strip()
        ]
        # OpenLibrary búsqueda básica para nutrición
        self.openlibrary_search_url = os.getenv(
            "OPENLIBRARY_SEARCH_URL", "https://openlibrary.org/search.json"
        )
        self.openlibrary_query = os.getenv("OPENLIBRARY_QUERY", "nutrition")
        self.request_timeout = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "10"))
        self.default_page_size = int(os.getenv("DEFAULT_PAGE_SIZE", "20"))
        self.max_page_size = int(os.getenv("MAX_PAGE_SIZE", "100"))


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de Settings."""
    return Settings()
