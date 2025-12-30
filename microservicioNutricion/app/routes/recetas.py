from __future__ import annotations

from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..database import get_session
from ..models import Alimento, Receta, RecetaAlimento
from ..schemas import (
    RecetaCreate,
    RecetaIngredienteCreate,
    RecetaRead,
    RecetaUpdate,
)
from ..services.nutrition import calcular_totales_receta

router = APIRouter()


def _to_decimal(value: Optional[float | int | Decimal]) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _build_receta_response(receta: Receta) -> RecetaRead:
    base = RecetaRead.from_orm(receta)
    return base.copy(update={"totales": calcular_totales_receta(receta)})


def _sincronizar_ingredientes(
    session: Session,
    receta: Receta,
    ingredientes: Optional[List[RecetaIngredienteCreate]],
) -> None:
    receta.ingredientes.clear()
    # Asegura que los ingredientes anteriores se eliminen en BD antes de insertar los nuevos
    # para evitar violar la restricciÃ³n Ãºnica (receta_id, alimento_id) cuando llegan
    # exactamente los mismos alimentos en una actualizaciÃ³n.
    session.flush()

    if not ingredientes:
        return

    vistos: set[int] = set()
    nuevos: list[RecetaAlimento] = []

    for item in ingredientes:
        alimento_id = item.alimento_id
        if alimento_id in vistos:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se permiten alimentos duplicados en la receta.",
            )

        if item.cantidad is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cada ingrediente debe incluir 'cantidad'.",
            )

        try:
            cantidad_val = float(item.cantidad)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cantidad debe ser numerica.",
            ) from exc

        if cantidad_val <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cantidad debe ser mayor a cero.",
            )

        alimento = session.get(Alimento, alimento_id)
        if alimento is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Alimento {alimento_id} no encontrado.",
            )

        unidad = item.unidad or alimento.unidad_base

        nuevos.append(
            RecetaAlimento(
                alimento=alimento,
                cantidad=_to_decimal(cantidad_val),
                unidad=unidad,
                observaciones=item.observaciones,
            )
        )
        vistos.add(alimento_id)

    receta.ingredientes = nuevos


def _select_recetas(buscar: Optional[str] = None):
    stmt = (
        select(Receta)
        .options(
            selectinload(Receta.ingredientes).selectinload(RecetaAlimento.alimento),
            selectinload(Receta.dietas),
        )
        .order_by(Receta.nombre.asc())
    )
    if buscar:
        like = f"%{buscar.lower()}%"
        stmt = stmt.where(func.lower(Receta.nombre).like(like))
    return stmt


@router.get("", response_model=List[RecetaRead])
def listar_recetas(
    buscar: Optional[str] = Query(default=None, description="Filtrar por nombre"),
    session: Session = Depends(get_session),
):
    recetas = session.execute(_select_recetas(buscar)).scalars().unique().all()
    return [_build_receta_response(receta) for receta in recetas]


@router.post("", response_model=RecetaRead, status_code=status.HTTP_201_CREATED)
def crear_receta(payload: RecetaCreate, session: Session = Depends(get_session)):
    if not payload.nombre:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El campo 'nombre' es obligatorio.",
        )

    receta = Receta(
        nombre=payload.nombre,
        descripcion=payload.descripcion,
        calorias_objetivo=_to_decimal(payload.calorias_objetivo),
        instrucciones=payload.instrucciones,
    )

    _sincronizar_ingredientes(session, receta, payload.ingredientes)

    session.add(receta)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No fue posible crear la receta: {exc.orig}",
        ) from exc

    session.refresh(receta)
    return _build_receta_response(receta)


def _obtener_receta(session: Session, receta_id: int) -> Receta:
    stmt = _select_recetas().where(Receta.id == receta_id)
    receta = session.execute(stmt).scalars().first()
    if receta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada")
    return receta


@router.get("/{receta_id}", response_model=RecetaRead)
def obtener_receta(receta_id: int, session: Session = Depends(get_session)):
    receta = _obtener_receta(session, receta_id)
    return _build_receta_response(receta)


@router.put("/{receta_id}", response_model=RecetaRead)
def actualizar_receta(
    receta_id: int,
    payload: RecetaUpdate,
    session: Session = Depends(get_session),
):
    receta = _obtener_receta(session, receta_id)

    if payload.nombre is not None:
        receta.nombre = payload.nombre
    if payload.descripcion is not None:
        receta.descripcion = payload.descripcion
    if payload.calorias_objetivo is not None:
        receta.calorias_objetivo = _to_decimal(payload.calorias_objetivo)
    if payload.instrucciones is not None:
        receta.instrucciones = payload.instrucciones

    if payload.ingredientes is not None:
        _sincronizar_ingredientes(session, receta, payload.ingredientes)

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No fue posible actualizar la receta: {exc.orig}",
        ) from exc

    session.refresh(receta)
    return _build_receta_response(receta)


@router.delete("/{receta_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_receta(receta_id: int, session: Session = Depends(get_session)):
    receta = _obtener_receta(session, receta_id)
    session.delete(receta)
    session.commit()
    return None
