from __future__ import annotations

from datetime import datetime
from typing import Any, List, Protocol

from pydantic import BaseModel


class ExternalDocument(BaseModel):
    """Representacion normalizada de un documento externo."""

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
    """Contrato de proveedores externos (actualmente deshabilitados)."""

    name: str

    async def fetch(self, limit: int | None = None) -> list[ExternalDocument]:
        ...
