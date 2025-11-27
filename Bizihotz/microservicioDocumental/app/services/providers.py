from __future__ import annotations

from datetime import datetime
from typing import Any, List, Protocol

import httpx
from pydantic import BaseModel


class ExternalDocument(BaseModel):
    """Documento tal y como lo entregan las APIs externas, normalizado a un DTO interno."""

    titulo: str
    descripcion: str | None = None
    etiquetas: List[str] = []
    tipo: str | None = None
    url_descarga: str | None = None
    external_id: str | None = None
    fuente: str
    idioma: str | None = None
    metadata: dict[str, Any] = {}
    published_at: datetime | None = None


class ExternalDocumentProvider(Protocol):
    """Contrato para cualquier proveedor externo de documentos."""

    name: str

    async def fetch(self, limit: int | None = None) -> list[ExternalDocument]:
        """Devuelve una lista de documentos normalizados."""
        ...


class OpenLibraryNutritionProvider:
    """Proveedor que consume OpenLibrary para obtener documentos/libros sobre nutrición."""

    name = "openlibrary"

    def __init__(self, search_url: str, query: str, timeout_seconds: float = 10) -> None:
        self.search_url = search_url
        self.query = query
        self.timeout_seconds = timeout_seconds

    async def fetch(self, limit: int | None = None) -> list[ExternalDocument]:
        params = {"q": self.query}
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.get(self.search_url, params=params)
            response.raise_for_status()
            data = response.json()

        docs = data.get("docs", [])
        documentos: list[ExternalDocument] = []
        for item in docs[: limit or len(docs)]:
            key = item.get("key") or ""
            title = item.get("title") or "Documento externo"
            authors = item.get("author_name") or []
            subjects = item.get("subject") or []
            first_publish_year = item.get("first_publish_year")
            external_url = f"https://openlibrary.org{key}" if key else None
            documentos.append(
                ExternalDocument(
                    titulo=title,
                    descripcion=f"Autores: {', '.join(authors)}" if authors else "Sin descripción",
                    etiquetas=[s for s in subjects[:5]] if subjects else ["openlibrary"],
                    tipo="libro",
                    url_descarga=external_url,
                    external_id=key,
                    fuente=self.name,
                    metadata={
                        "authors": authors,
                        "subjects": subjects,
                        "first_publish_year": first_publish_year,
                        "openlibrary_key": key,
                        "source_url": external_url,
                    },
                )
            )

        return documentos
