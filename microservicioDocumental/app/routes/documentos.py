from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_session
from ..models import Documento
from ..schemas.document import DocumentoRead

router = APIRouter(prefix="/api/documentos", tags=["documentos"])

REMOTE_FETCH_TIMEOUT = 20.0


def _is_postgres(session: Session) -> bool:
    bind = session.get_bind()
    if not bind:
        return False
    return bind.dialect.name.startswith("postgres")


@router.get("", response_model=List[DocumentoRead])
def listar_documentos(
    q: Optional[str] = Query(None, description="Texto a buscar en titulo/descripcion"),
    fuente: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    etiqueta: Optional[str] = Query(None, description="Filtra documentos que contengan esta etiqueta"),
    skip: int = Query(0, ge=0),
    limit: int = Query(None, ge=1),
    session: Session = Depends(get_session),
):
    settings = get_settings()
    limit_real = limit or settings.default_page_size
    limit_real = min(limit_real, settings.max_page_size)

    query = select(Documento)
    order_by_clauses = []

    if q:
        if _is_postgres(session):
            ts_vector = func.to_tsvector(
                "spanish",
                func.concat_ws(
                    " ",
                    func.coalesce(Documento.titulo, ""),
                    func.coalesce(Documento.descripcion, ""),
                ),
            )
            ts_query = func.plainto_tsquery("spanish", q)
            query = query.where(ts_vector.op("@@")(ts_query))
            order_by_clauses.append(func.ts_rank(ts_vector, ts_query).desc())
        else:
            patron = f"%{q}%"
            query = query.where(
                or_(
                    Documento.titulo.ilike(patron),
                    Documento.descripcion.ilike(patron),
                )
            )
    if fuente:
        query = query.where(Documento.fuente == fuente)
    if tipo:
        query = query.where(Documento.tipo == tipo)
    if etiqueta:
        query = query.where(Documento.etiquetas.contains([etiqueta]))

    if not order_by_clauses:
        order_by_clauses.append(Documento.fecha_subida.desc())

    query = query.order_by(*order_by_clauses).offset(skip).limit(limit_real)
    resultados = session.scalars(query).all()
    return resultados


@router.get("/{documento_id}", response_model=DocumentoRead)
def obtener_documento(
    documento_id: int,
    session: Session = Depends(get_session),
):
    query = select(Documento).where(Documento.id == documento_id)
    documento = session.execute(query).scalar_one_or_none()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return documento


def _resolve_document_url(documento: Documento) -> Optional[str]:
    if documento.url_descarga:
        return documento.url_descarga
    if documento.ruta_archivo:
        return documento.ruta_archivo
    metadata = getattr(documento, "metadata_json", {}) or {}
    return metadata.get("url")


def _safe_filename(url: str, fallback: str = "documento") -> str:
    parsed = urlparse(url)
    candidate = Path(parsed.path).name
    if candidate:
        return candidate
    return (fallback or "documento").replace('"', "").replace("\\", "")


async def _proxy_remote_document(url: str, fallback_name: str) -> StreamingResponse:
    try:
        async with httpx.AsyncClient(timeout=REMOTE_FETCH_TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()

            content = resp.content
            content_type = resp.headers.get("content-type", "application/pdf")
            filename = _safe_filename(url, fallback=fallback_name)

            headers = {
                "Content-Disposition": f'inline; filename="{filename}"',
                "Content-Length": str(len(content)),
            }

            # Response fija evita desajustes de Content-Length/transfer-encoding
            return Response(content=content, media_type=content_type, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"No se pudo recuperar el documento desde el origen: {exc}",
        ) from exc


@router.get("/{documento_id}/contenido")
async def obtener_documento_contenido(
    documento_id: int,
    session: Session = Depends(get_session),
):
    query = select(Documento).where(Documento.id == documento_id)
    documento = session.execute(query).scalar_one_or_none()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    origen = _resolve_document_url(documento)
    if not origen:
        raise HTTPException(status_code=404, detail="Documento sin URL de descarga")

    if origen.startswith(("http://", "https://")):
        return await _proxy_remote_document(origen, documento.titulo or "documento")

    ruta_archivo = Path(origen)
    if not ruta_archivo.is_file():
        raise HTTPException(status_code=404, detail="Documento no disponible en el servidor")

    guessed_type, _ = mimetypes.guess_type(str(ruta_archivo))
    return FileResponse(
        ruta_archivo,
        media_type=guessed_type or "application/octet-stream",
        filename=ruta_archivo.name,
    )
