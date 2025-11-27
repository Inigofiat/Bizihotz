from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import Field

from .base import ORMModel


class DocumentoBase(ORMModel):
    titulo: str
    descripcion: Optional[str] = None
    etiquetas: List[str] = []
    tipo: Optional[str] = None
    fuente: str
    external_id: Optional[str] = None
    url_descarga: Optional[str] = None
    ruta_archivo: Optional[str] = None
    idioma: Optional[str] = None
    estado: str = "activo"
    metadata: dict[str, Any] = Field(default_factory=dict, alias="metadata_json")


class DocumentoCreate(DocumentoBase):
    """Payload interno para crear/actualizar documentos."""

    pass


class DocumentoRead(DocumentoBase):
    id: int
    fecha_subida: datetime
    last_synced_at: Optional[datetime] = None
