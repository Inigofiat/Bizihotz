from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_session
from ..models import Documento
from ..schemas.document import DocumentoRead
from ..services.ingestion import sync_fuente

router = APIRouter(prefix="/api/documentos", tags=["documentos"])


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


@router.post("/sync/{fuente}")
async def sincronizar_fuente(
    fuente: str,
    limit: Optional[int] = Query(None, ge=1, le=1000),
    session: Session = Depends(get_session),
):
    settings = get_settings()
    if fuente not in settings.enabled_sources:
        raise HTTPException(status_code=400, detail="Fuente no habilitada en configuración")
    resultado = await sync_fuente(fuente, session, settings, limit=limit)
    return resultado
