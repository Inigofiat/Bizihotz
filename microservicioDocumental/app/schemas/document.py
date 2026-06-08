from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import AliasChoices, Field

from .base import ORMModel


class DocumentoBase(ORMModel):
    titulo: str
    descripcion: Optional[str] = None
    etiquetas: List[str] = []
    tipo: Optional[str] = None
    fuente: str
    external_id: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("external_id", "refer")
    )
    url_descarga: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("url_descarga", "url")
    )
    ruta_archivo: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("ruta_archivo", "rutaArchivo")
    )
    idioma: Optional[str] = None
    estado: str = "activo"
    metadata: dict[str, Any] = Field(default_factory=dict, alias="metadata_json")


class DocumentoCreate(DocumentoBase):
    """Payload interno para crear/actualizar documentos."""

    pass


class DocumentoRead(DocumentoBase):
    id: int
    fecha_subida: datetime = Field(
        validation_alias=AliasChoices("fecha_subida", "fechaSubida")
    )
    last_synced_at: Optional[datetime] = Field(
        default=None, validation_alias=AliasChoices("last_synced_at", "ultimaAct")
    )
