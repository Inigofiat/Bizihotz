from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..database import get_session
from ..models import Dieta, DietaReceta, Receta, RecetaAlimento
from ..schemas import DietaCreate, DietaRead, DietaRecetaCreate, DietaUpdate
from ..services.nutrition import calcular_totales_dieta

router = APIRouter()


def _to_decimal(value: Optional[float | int | Decimal]) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _build_dieta_response(dieta: Dieta) -> DietaRead:
    base = DietaRead.from_orm(dieta)
    return base.copy(update={"totales": calcular_totales_dieta(dieta.recetas)})


def _sincronizar_recetas(
    session: Session,
    dieta: Dieta,
    recetas_data: Optional[List[DietaRecetaCreate]],
) -> None:
    dieta.recetas.clear()

    if not recetas_data:
        return

    nuevos: list[DietaReceta] = []
    for item in recetas_data:
        receta = session.get(Receta, item.receta_id)
        if receta is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Receta {item.receta_id} no encontrada.",
            )

        nuevos.append(
            DietaReceta(
                receta=receta,
                dia_semana=item.dia_semana,
                momento=item.momento,
                orden=item.orden,
                porciones=item.porciones or 1,
            )
        )

    dieta.recetas = nuevos


def _dieta_base_stmt():
    return (
        select(Dieta)
        .options(
            selectinload(Dieta.recetas)
            .selectinload(DietaReceta.receta)
            .selectinload(Receta.ingredientes)
            .selectinload(RecetaAlimento.alimento)
        )
        .order_by(Dieta.creado_en.desc())
    )


def _obtener_dieta(session: Session, dieta_id: int) -> Dieta:
    stmt = _dieta_base_stmt().where(Dieta.id == dieta_id)
    dieta = session.execute(stmt).scalars().unique().first()
    if dieta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dieta no encontrada")
    return dieta


@router.get("", response_model=List[DietaRead])
def listar_dietas(
    paciente_id: Optional[int] = Query(default=None),
    usuario_id: Optional[int] = Query(default=None),
    session: Session = Depends(get_session),
):
    stmt = _dieta_base_stmt()
    if paciente_id is not None:
        stmt = stmt.where(Dieta.paciente_id == paciente_id)
    if usuario_id is not None:
        stmt = stmt.where(Dieta.usuario_id == usuario_id)

    dietas = session.execute(stmt).scalars().unique().all()
    return [_build_dieta_response(dieta) for dieta in dietas]


@router.post("", response_model=DietaRead, status_code=status.HTTP_201_CREATED)
def crear_dieta(payload: DietaCreate, session: Session = Depends(get_session)):
    fecha_inicio = payload.fecha_inicio or date.today()
    dieta = Dieta(
        nombre=payload.nombre,
        objetivo=payload.objetivo,
        descripcion=payload.descripcion,
        calorias_objetivo=_to_decimal(payload.calorias_objetivo),
        fecha_inicio=fecha_inicio,
        fecha_fin=payload.fecha_fin,
        paciente_id=payload.paciente_id,
        usuario_id=payload.usuario_id,
    )

    _sincronizar_recetas(session, dieta, payload.recetas)

    session.add(dieta)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No fue posible crear la dieta: {exc.orig}",
        ) from exc

    session.refresh(dieta)
    return _build_dieta_response(dieta)


@router.get("/{dieta_id}", response_model=DietaRead)
def obtener_dieta(dieta_id: int, session: Session = Depends(get_session)):
    dieta = _obtener_dieta(session, dieta_id)
    return _build_dieta_response(dieta)


@router.put("/{dieta_id}", response_model=DietaRead)
def actualizar_dieta(
    dieta_id: int,
    payload: DietaUpdate,
    session: Session = Depends(get_session),
):
    dieta = _obtener_dieta(session, dieta_id)

    if payload.nombre is not None:
        dieta.nombre = payload.nombre
    if payload.objetivo is not None:
        dieta.objetivo = payload.objetivo
    if payload.descripcion is not None:
        dieta.descripcion = payload.descripcion
    if payload.calorias_objetivo is not None:
        dieta.calorias_objetivo = _to_decimal(payload.calorias_objetivo)
    if payload.fecha_inicio is not None:
        dieta.fecha_inicio = payload.fecha_inicio
    if payload.fecha_fin is not None:
        dieta.fecha_fin = payload.fecha_fin
    if payload.paciente_id is not None:
        dieta.paciente_id = payload.paciente_id
    if payload.usuario_id is not None:
        dieta.usuario_id = payload.usuario_id

    if payload.recetas is not None:
        _sincronizar_recetas(session, dieta, payload.recetas)

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No fue posible actualizar la dieta: {exc.orig}",
        ) from exc

    session.refresh(dieta)
    return _build_dieta_response(dieta)


@router.delete("/{dieta_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_dieta(dieta_id: int, session: Session = Depends(get_session)):
    dieta = _obtener_dieta(session, dieta_id)
    session.delete(dieta)
    session.commit()
    return None
