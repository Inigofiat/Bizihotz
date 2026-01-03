from __future__ import annotations

from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_session
from ..models import Alimento
from ..schemas import AlimentoCreate, AlimentoRead, AlimentoUpdate
from ..services.bedca import sync_bedca_alimentos

router = APIRouter()


def _to_decimal(value: Optional[float | int | Decimal]) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _build_response(alimento: Alimento) -> AlimentoRead:
    return AlimentoRead.from_orm(alimento)


@router.get("", response_model=List[AlimentoRead])
def listar_alimentos(
    buscar: Optional[str] = Query(default=None, description="Texto a buscar en el nombre"),
    session: Session = Depends(get_session),
):
    stmt = select(Alimento).order_by(Alimento.nombre.asc())
    if buscar:
        like = f"%{buscar.lower()}%"
        stmt = stmt.where(func.lower(Alimento.nombre).like(like))

    alimentos = session.execute(stmt).scalars().all()
    return [_build_response(alimento) for alimento in alimentos]


@router.post("", response_model=AlimentoRead, status_code=status.HTTP_201_CREATED)
def crear_alimento(payload: AlimentoCreate, session: Session = Depends(get_session)):
    alimento = Alimento(
        nombre=payload.nombre,
        descripcion=payload.descripcion,
        calorias=_to_decimal(payload.calorias),
        proteinas=_to_decimal(payload.proteinas),
        grasas=_to_decimal(payload.grasas),
        carbohidratos=_to_decimal(payload.carbohidratos),
        fibra=_to_decimal(payload.fibra),
        unidad_base=payload.unidad_base,
        micronutrientes=payload.micronutrientes or {},
    )

    session.add(alimento)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El alimento ya existe") from exc

    session.refresh(alimento)
    return _build_response(alimento)


def _obtener_alimento(alimento_id: int, session: Session) -> Alimento:
    alimento = session.get(Alimento, alimento_id)
    if alimento is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alimento no encontrado")
    return alimento


@router.get("/{alimento_id}", response_model=AlimentoRead)
def obtener_alimento(alimento_id: int, session: Session = Depends(get_session)):
    alimento = _obtener_alimento(alimento_id, session)
    return _build_response(alimento)


@router.put("/{alimento_id}", response_model=AlimentoRead)
def actualizar_alimento(
    alimento_id: int,
    payload: AlimentoUpdate,
    session: Session = Depends(get_session),
):
    alimento = _obtener_alimento(alimento_id, session)

    alimento.nombre = payload.nombre
    alimento.descripcion = payload.descripcion
    alimento.calorias = _to_decimal(payload.calorias)
    alimento.proteinas = _to_decimal(payload.proteinas)
    alimento.grasas = _to_decimal(payload.grasas)
    alimento.carbohidratos = _to_decimal(payload.carbohidratos)
    alimento.fibra = _to_decimal(payload.fibra)
    alimento.unidad_base = payload.unidad_base
    alimento.micronutrientes = payload.micronutrientes or {}

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El nombre de alimento ya esta en uso",
        ) from exc

    session.refresh(alimento)
    return _build_response(alimento)


@router.delete("/{alimento_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_alimento(alimento_id: int, session: Session = Depends(get_session)):
    alimento = _obtener_alimento(alimento_id, session)
    session.delete(alimento)
    session.commit()
    return None


@router.post("/bedca/sync", response_model=dict)
def sincronizar_bedca(session: Session = Depends(get_session)):
    """
    Importa/actualiza alimentos desde la base publica BEDCA.
    """
    try:
        resultado = sync_bedca_alimentos(session)
        return resultado
    except Exception as exc:  # pragma: no cover - capa de seguridad
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
