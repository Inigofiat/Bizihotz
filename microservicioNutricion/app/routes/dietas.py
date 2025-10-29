from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Iterable, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings
from ..database import get_session
from ..models import AsignacionDieta, Dieta, DietaReceta, Receta, RecetaAlimento
from ..schemas import (
    DietaAsignacionCreate,
    DietaAsignacionRead,
    DietaCreate,
    DietaNotificacionRequest,
    DietaRead,
    DietaRecetaCreate,
    DietaUpdate,
    DietaVersionPayload,
)
from ..services.communication import enviar_notificacion_dieta
from ..services.export import generar_csv_dieta, generar_pdf_dieta
from ..services.nutrition import calcular_totales_dieta

router = APIRouter()


def _to_decimal(value: Optional[float | int | Decimal]) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _ordenar_asignaciones(asignaciones: Iterable[AsignacionDieta]) -> List[DietaAsignacionRead]:
    ordenadas = sorted(asignaciones, key=lambda item: item.fecha_asignacion, reverse=True)
    return [DietaAsignacionRead.from_orm(item) for item in ordenadas]


def _build_dieta_response(dieta: Dieta) -> DietaRead:
    base = DietaRead.from_orm(dieta)
    return base.copy(
        update={
            "totales": calcular_totales_dieta(dieta.recetas),
            "asignaciones": _ordenar_asignaciones(dieta.asignaciones),
        }
    )


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


def _copiar_recetas(origen: Dieta) -> list[DietaReceta]:
    copias: list[DietaReceta] = []
    for item in origen.recetas:
        receta = item.receta
        if receta is None:
            continue
        copias.append(
            DietaReceta(
                receta=receta,
                dia_semana=item.dia_semana,
                momento=item.momento,
                orden=item.orden,
                porciones=item.porciones,
            )
        )
    return copias


def _clonar_dieta(
    session: Session,
    origen: Dieta,
    overrides: Optional[DietaVersionPayload],
    *,
    paciente_id: Optional[int],
    usuario_id: int,
    parent: Optional[Dieta],
    version: int,
    es_plantilla: bool,
    estado: str,
    activa: bool,
) -> Dieta:
    nombre = origen.nombre
    objetivo = origen.objetivo
    descripcion = origen.descripcion
    calorias_objetivo = origen.calorias_objetivo
    fecha_inicio = origen.fecha_inicio
    fecha_fin = origen.fecha_fin
    notas = origen.notas

    if overrides:
        if overrides.nombre is not None:
            nombre = overrides.nombre
        if overrides.objetivo is not None:
            objetivo = overrides.objetivo
        if overrides.descripcion is not None:
            descripcion = overrides.descripcion
        if overrides.calorias_objetivo is not None:
            calorias_objetivo = _to_decimal(overrides.calorias_objetivo)
        if overrides.fecha_inicio is not None:
            fecha_inicio = overrides.fecha_inicio
        if overrides.fecha_fin is not None:
            fecha_fin = overrides.fecha_fin
        if overrides.notas is not None:
            notas = overrides.notas

    fecha_inicio = fecha_inicio or date.today()

    nueva = Dieta(
        nombre=nombre,
        objetivo=objetivo,
        descripcion=descripcion,
        calorias_objetivo=_to_decimal(calorias_objetivo),
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        paciente_id=paciente_id,
        usuario_id=usuario_id,
        es_plantilla=es_plantilla,
        version=version,
        estado=estado,
        activa=activa,
        notas=notas,
    )

    if parent is not None:
        nueva.parent = parent

    if overrides and overrides.recetas is not None:
        _sincronizar_recetas(session, nueva, overrides.recetas)
    else:
        nueva.recetas = _copiar_recetas(origen)

    return nueva


def _desactivar_asignaciones(session: Session, paciente_id: int, excluir_dieta_id: Optional[int] = None) -> None:
    stmt = select(AsignacionDieta).where(
        AsignacionDieta.paciente_id == paciente_id,
        AsignacionDieta.es_actual.is_(True),
    )
    if excluir_dieta_id is not None:
        stmt = stmt.where(AsignacionDieta.dieta_id != excluir_dieta_id)

    asignaciones = session.execute(stmt).scalars().all()
    for asignacion in asignaciones:
        asignacion.es_actual = False


def _dieta_base_stmt():
    return (
        select(Dieta)
        .options(
            selectinload(Dieta.recetas)
            .selectinload(DietaReceta.receta)
            .selectinload(Receta.ingredientes)
            .selectinload(RecetaAlimento.alimento),
            selectinload(Dieta.asignaciones),
            selectinload(Dieta.parent),
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
    es_plantilla: Optional[bool] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    activa: Optional[bool] = Query(default=None),
    parent_id: Optional[int] = Query(default=None),
    solo_actuales: bool = Query(
        default=False, description="Solo dietas con asignación vigente."
    ),
    session: Session = Depends(get_session),
):
    stmt = _dieta_base_stmt()
    if paciente_id is not None:
        stmt = stmt.where(Dieta.paciente_id == paciente_id)
    if usuario_id is not None:
        stmt = stmt.where(Dieta.usuario_id == usuario_id)
    if es_plantilla is not None:
        stmt = stmt.where(Dieta.es_plantilla.is_(es_plantilla))
    if estado is not None:
        stmt = stmt.where(Dieta.estado == estado)
    if activa is not None:
        stmt = stmt.where(Dieta.activa.is_(activa))
    if parent_id is not None:
        stmt = stmt.where(Dieta.parent_id == parent_id)
    if solo_actuales:
        stmt = stmt.join(Dieta.asignaciones).where(AsignacionDieta.es_actual.is_(True))

    dietas = session.execute(stmt).scalars().unique().all()
    return [_build_dieta_response(dieta) for dieta in dietas]


@router.post("", response_model=DietaRead, status_code=status.HTTP_201_CREATED)
def crear_dieta(payload: DietaCreate, session: Session = Depends(get_session)):
    if not payload.es_plantilla and payload.paciente_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Las dietas personalizadas deben indicar paciente_id.",
        )

    estado = payload.estado or ("borrador" if payload.es_plantilla else "publicada")
    activa = payload.activa if payload.activa is not None else not payload.es_plantilla

    dieta = Dieta(
        nombre=payload.nombre,
        objetivo=payload.objetivo,
        descripcion=payload.descripcion,
        calorias_objetivo=_to_decimal(payload.calorias_objetivo),
        fecha_inicio=payload.fecha_inicio or date.today(),
        fecha_fin=payload.fecha_fin,
        paciente_id=payload.paciente_id,
        usuario_id=payload.usuario_id,
        es_plantilla=payload.es_plantilla,
        estado=estado,
        activa=activa,
        notas=payload.notas,
    )

    if payload.parent_id:
        parent = session.get(Dieta, payload.parent_id)
        if parent is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dieta base {payload.parent_id} no encontrada.",
            )
        dieta.parent = parent

    if not payload.es_plantilla and activa:
        dieta.publicada_en = datetime.utcnow()

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
    if payload.notas is not None:
        dieta.notas = payload.notas
    if payload.paciente_id is not None:
        dieta.paciente_id = payload.paciente_id
    if payload.usuario_id is not None:
        dieta.usuario_id = payload.usuario_id
    if payload.es_plantilla is not None:
        dieta.es_plantilla = payload.es_plantilla
    if payload.estado is not None:
        dieta.estado = payload.estado
    if payload.activa is not None:
        dieta.activa = payload.activa
    if payload.parent_id is not None:
        parent = session.get(Dieta, payload.parent_id)
        if parent is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dieta base {payload.parent_id} no encontrada.",
            )
        dieta.parent = parent

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


@router.post(
    "/{dieta_id}/asignaciones",
    response_model=DietaRead,
    status_code=status.HTTP_201_CREATED,
)
def asignar_dieta(
    dieta_id: int,
    payload: DietaAsignacionCreate,
    session: Session = Depends(get_session),
):
    origen = _obtener_dieta(session, dieta_id)

    if not origen.es_plantilla and origen.paciente_id not in (None, payload.paciente_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La dieta ya está asociada a otro paciente.",
        )

    nueva = _clonar_dieta(
        session,
        origen,
        payload,
        paciente_id=payload.paciente_id,
        usuario_id=payload.usuario_id,
        parent=origen,
        version=1,
        es_plantilla=False,
        estado="publicada",
        activa=True,
    )
    nueva.publicada_en = datetime.utcnow()

    session.add(nueva)
    session.flush()  # asegurar que nueva.id esté disponible para la asignación

    _desactivar_asignaciones(session, payload.paciente_id)

    asignacion = AsignacionDieta(
        dieta=nueva,
        paciente_id=payload.paciente_id,
        usuario_id=payload.usuario_id,
        version=nueva.version,
        comentario=payload.comentario,
    )
    session.add(asignacion)

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No fue posible asignar la dieta: {exc.orig}",
        ) from exc

    session.refresh(nueva)
    return _build_dieta_response(nueva)


@router.post(
    "/{dieta_id}/versionar",
    response_model=DietaRead,
    status_code=status.HTTP_201_CREATED,
)
def versionar_dieta(
    dieta_id: int,
    payload: DietaVersionPayload,
    session: Session = Depends(get_session),
):
    actual = _obtener_dieta(session, dieta_id)

    if actual.es_plantilla:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No es posible versionar una plantilla directamente. Asigne primero al paciente.",
        )
    if actual.paciente_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La dieta no tiene paciente asociado para generar una versión.",
        )

    nueva = _clonar_dieta(
        session,
        actual,
        payload,
        paciente_id=actual.paciente_id,
        usuario_id=payload.usuario_id,
        parent=actual,
        version=actual.version + 1,
        es_plantilla=False,
        estado="publicada",
        activa=True,
    )
    nueva.publicada_en = datetime.utcnow()
    actual.activa = False
    actual.estado = "historica"

    session.add(nueva)
    session.flush()

    _desactivar_asignaciones(session, actual.paciente_id, excluir_dieta_id=nueva.id)
    asignacion = AsignacionDieta(
        dieta=nueva,
        paciente_id=actual.paciente_id,
        usuario_id=payload.usuario_id,
        version=nueva.version,
        comentario=payload.comentario,
    )
    session.add(asignacion)

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No fue posible generar la nueva versión: {exc.orig}",
        ) from exc

    session.refresh(nueva)
    return _build_dieta_response(nueva)


@router.get(
    "/{dieta_id}/exportar",
    response_class=Response,
)
def exportar_dieta(
    dieta_id: int,
    formato: str = Query(default="pdf", enum=["pdf", "csv"]),
    session: Session = Depends(get_session),
):
    dieta = _obtener_dieta(session, dieta_id)
    settings = get_settings()

    if formato == "pdf":
        contenido, nombre = generar_pdf_dieta(dieta, settings.export_footer_note)
        media_type = "application/pdf"
    else:
        contenido, nombre = generar_csv_dieta(dieta)
        media_type = "text/csv"

    headers = {"Content-Disposition": f'attachment; filename="{nombre}"'}
    return Response(content=contenido, media_type=media_type, headers=headers)


@router.post(
    "/{dieta_id}/notificar",
    status_code=status.HTTP_202_ACCEPTED,
)
def notificar_dieta(
    dieta_id: int,
    payload: DietaNotificacionRequest,
    session: Session = Depends(get_session),
):
    dieta = _obtener_dieta(session, dieta_id)
    if dieta.paciente_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La dieta no está asignada a un paciente.",
        )

    asignacion_actual = next((item for item in dieta.asignaciones if item.es_actual), None)
    try:
        resultado = enviar_notificacion_dieta(
            dieta,
            payload.canal,
            payload.asunto,
            payload.mensaje,
            payload.adjuntar_pdf,
            payload.adjuntar_csv,
            payload.enviar_copia_profesional,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    if asignacion_actual:
        asignacion_actual.notificado_en = datetime.utcnow()
        session.add(asignacion_actual)
        session.commit()

    return {"resultado": resultado}
