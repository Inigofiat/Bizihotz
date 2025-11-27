from __future__ import annotations

from datetime import datetime
from typing import Dict, List

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import Documento
from .providers import (
    ExternalDocument,
    ExternalDocumentProvider,
    OpenLibraryNutritionProvider,
)


def _provider_registry(settings: Settings) -> Dict[str, ExternalDocumentProvider]:
    """Registra las fuentes disponibles."""
    return {
        "openlibrary": OpenLibraryNutritionProvider(
            settings.openlibrary_search_url,
            settings.openlibrary_query,
            settings.request_timeout,
        ),
        # Añade aquí otros proveedores reales, ej. "openfoodfacts"
    }


def get_provider(nombre: str, settings: Settings) -> ExternalDocumentProvider:
    providers = _provider_registry(settings)
    if nombre not in providers:
        raise ValueError(f"La fuente '{nombre}' no está configurada.")
    return providers[nombre]


def _upsert_documento(session: Session, externo: ExternalDocument) -> str:
    """Crea o actualiza un documento a partir de datos externos."""
    query: Select[tuple[Documento]] = select(Documento).where(
        Documento.fuente == externo.fuente,
        Documento.external_id == externo.external_id,
    )
    existente = session.execute(query).scalar_one_or_none()

    if existente:
        existente.titulo = externo.titulo
        existente.descripcion = externo.descripcion
        existente.etiquetas = externo.etiquetas or []
        existente.tipo = externo.tipo
        existente.url_descarga = externo.url_descarga
        existente.metadata_json = externo.metadata
        existente.idioma = externo.idioma
        existente.estado = "activo"
        existente.last_synced_at = datetime.utcnow()
        return "updated"

    nuevo = Documento(
        titulo=externo.titulo,
        descripcion=externo.descripcion,
        etiquetas=externo.etiquetas or [],
        tipo=externo.tipo,
        fuente=externo.fuente,
        external_id=externo.external_id,
        url_descarga=externo.url_descarga,
        ruta_archivo=None,
        idioma=externo.idioma,
        estado="activo",
        metadata_json=externo.metadata,
        fecha_subida=externo.published_at or datetime.utcnow(),
        last_synced_at=datetime.utcnow(),
    )
    session.add(nuevo)
    return "created"


async def sync_fuente(
    fuente: str,
    session: Session,
    settings: Settings,
    limit: int | None = None,
) -> dict:
    provider = get_provider(fuente, settings)
    externos: List[ExternalDocument] = await provider.fetch(limit=limit)

    created = 0
    updated = 0

    for doc in externos:
        resultado = _upsert_documento(session, doc)
        if resultado == "created":
            created += 1
        else:
            updated += 1

    session.commit()
    return {
        "fuente": fuente,
        "creados": created,
        "actualizados": updated,
        "procesados": len(externos),
    }
