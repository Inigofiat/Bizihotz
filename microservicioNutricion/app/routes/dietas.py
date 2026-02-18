from __future__ import annotations

from datetime import date, datetime
import json
from decimal import Decimal
from typing import Iterable, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings
from ..database import get_session
from ..models import (
    AsignacionDieta,
    Dieta,
    DietaHistorial,
    DietaReceta,
    Receta,
    RecetaAlimento,
)
from ..schemas import (
    DietaAsignacionCreate,
    DietaAsignacionRead,
    DietaCreate,
    DietaHistorialRead,
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


def _ordenar_historial(historial: Iterable[DietaHistorial]) -> List[DietaHistorialRead]:
    ordenados = sorted(historial, key=lambda item: item.registrado_en, reverse=True)
    salida: list[DietaHistorialRead] = []
    for item in ordenados:
        snapshot = None
        if item.snapshot_data:
            try:
                snapshot = json.loads(item.snapshot_data)
            except json.JSONDecodeError:
                snapshot = None
        salida.append(
            DietaHistorialRead(
                id=item.id,
                dieta_id=item.dieta_id,
                usuario_id=item.usuario_id,
                detalle=item.detalle,
                snapshot=snapshot,
                registrado_en=item.registrado_en,
            )
        )
    return salida


def _snapshot_dieta(dieta: Dieta) -> dict:
    parsed_desc = None
    if dieta.descripcion:
        try:
            parsed_desc = json.loads(dieta.descripcion)
        except json.JSONDecodeError:
            parsed_desc = dieta.descripcion
    return {
        "id": dieta.id,
        "version": dieta.version,
        "nombre": dieta.nombre,
        "objetivo": dieta.objetivo,
        "descripcion": parsed_desc,
        "calorias_objetivo": float(dieta.calorias_objetivo) if dieta.calorias_objetivo is not None else None,
        "fecha_inicio": dieta.fecha_inicio.isoformat() if dieta.fecha_inicio else None,
        "fecha_fin": dieta.fecha_fin.isoformat() if dieta.fecha_fin else None,
        "notas": dieta.notas,
        "paciente_id": dieta.paciente_id,
        "usuario_id": dieta.usuario_id,
        "es_plantilla": dieta.es_plantilla,
        "estado": dieta.estado,
        "activa": dieta.activa,
        "totales": calcular_totales_dieta(dieta.recetas),
    }


def _build_dieta_response(dieta: Dieta) -> DietaRead:
    base = DietaRead.from_orm(dieta)
    return base.copy(
        update={
            "totales": calcular_totales_dieta(dieta.recetas),
            "asignaciones": _ordenar_asignaciones(dieta.asignaciones),
            "historial": _ordenar_historial(dieta.historial),
        }
    )


def _sincronizar_recetas(
    session: Session,
    dieta: Dieta,
    recetas_data: Optional[List[DietaRecetaCreate]],
) -> None:
    tenia_recetas = bool(dieta.recetas)
    dieta.recetas.clear()
    if tenia_recetas:
        # Asegura que las recetas anteriores se eliminen en la BD antes de insertar las nuevas.
        session.flush()

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
    paciente_id: Optional[str],
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


def _desactivar_asignaciones(
    session: Session, paciente_id: str, excluir_dieta_id: Optional[int] = None
) -> None:
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
            selectinload(Dieta.historial),
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
    paciente_id: Optional[str] = Query(default=None),
    usuario_id: Optional[int] = Query(default=None),
    es_plantilla: Optional[bool] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    activa: Optional[bool] = Query(default=None),
    parent_id: Optional[int] = Query(default=None),
    solo_actuales: bool = Query(
        default=False, description="Solo dietas con asignacion vigente."
    ),
    session: Session = Depends(get_session),
):
    stmt = _dieta_base_stmt()
    paciente_id_filter = paciente_id.strip() if paciente_id else None
    if paciente_id_filter is not None:
        stmt = stmt.where(Dieta.paciente_id == paciente_id_filter)
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
    paciente_id = payload.paciente_id.strip() if payload.paciente_id else None
    if not payload.es_plantilla and not paciente_id:
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
        paciente_id=paciente_id,
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

    dieta.historial.append(
        DietaHistorial(
            usuario_id=payload.usuario_id,
            detalle="Creacion de dieta",
            snapshot_data=json.dumps(_snapshot_dieta(dieta)),
        )
    )

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


@router.delete("/{dieta_id}/historial/{historial_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_historial_dieta(
    dieta_id: int,
    historial_id: int,
    session: Session = Depends(get_session),
):
    dieta = _obtener_dieta(session, dieta_id)
    target = next((h for h in dieta.historial if h.id == historial_id), None)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entrada de historial no encontrada para esta dieta.",
        )
    session.delete(target)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{dieta_id}", response_model=DietaRead)
def actualizar_dieta(
    dieta_id: int,
    payload: DietaUpdate,
    session: Session = Depends(get_session),
):
    dieta = _obtener_dieta(session, dieta_id)
    campos_modificados: set[str] = set()
    usuario_historial = payload.actor_usuario_id or payload.usuario_id or dieta.usuario_id

    if payload.nombre is not None:
        dieta.nombre = payload.nombre
        campos_modificados.add("nombre")
    if payload.objetivo is not None:
        dieta.objetivo = payload.objetivo
        campos_modificados.add("objetivo")
    if payload.descripcion is not None:
        dieta.descripcion = payload.descripcion
        campos_modificados.add("descripcion")
    if payload.calorias_objetivo is not None:
        dieta.calorias_objetivo = _to_decimal(payload.calorias_objetivo)
        campos_modificados.add("calorias_objetivo")
    if payload.fecha_inicio is not None:
        dieta.fecha_inicio = payload.fecha_inicio
        campos_modificados.add("fecha_inicio")
    if payload.fecha_fin is not None:
        dieta.fecha_fin = payload.fecha_fin
        campos_modificados.add("fecha_fin")
    if payload.notas is not None:
        dieta.notas = payload.notas
        campos_modificados.add("notas")
    if payload.paciente_id is not None:
        paciente_actualizado = payload.paciente_id.strip()
        dieta.paciente_id = paciente_actualizado or None
        campos_modificados.add("paciente_id")
    if payload.usuario_id is not None:
        dieta.usuario_id = payload.usuario_id
        campos_modificados.add("usuario_id")
    if payload.es_plantilla is not None:
        dieta.es_plantilla = payload.es_plantilla
        campos_modificados.add("es_plantilla")
    if payload.estado is not None:
        dieta.estado = payload.estado
        campos_modificados.add("estado")
    if payload.activa is not None:
        dieta.activa = payload.activa
        campos_modificados.add("activa")
    if payload.parent_id is not None:
        parent = session.get(Dieta, payload.parent_id)
        if parent is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dieta base {payload.parent_id} no encontrada.",
            )
        dieta.parent = parent
        campos_modificados.add("parent_id")

    if payload.recetas is not None:
        _sincronizar_recetas(session, dieta, payload.recetas)
        campos_modificados.add("recetas")

    usuario_historial = payload.usuario_id or dieta.usuario_id
    if campos_modificados:
        detalle = f"v{dieta.version}: Actualizacion de campos: {', '.join(sorted(campos_modificados))}"
    else:
        detalle = f"v{dieta.version}: Actualizacion registrada sin cambios de campos"
    dieta.historial.append(
        DietaHistorial(
            usuario_id=usuario_historial,
            detalle=detalle,
            snapshot_data=json.dumps(_snapshot_dieta(dieta)),
        )
    )

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
    paciente_id = payload.paciente_id.strip()
    if not paciente_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe proporcionar un identificador de paciente valido.",
        )

    origen = _obtener_dieta(session, dieta_id)

    if not origen.es_plantilla and origen.paciente_id not in (None, paciente_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La dieta ya esta asociada a otro paciente.",
        )

    nueva = _clonar_dieta(
        session,
        origen,
        payload,
        paciente_id=paciente_id,
        usuario_id=payload.usuario_id,
        parent=origen,
        version=1,
        es_plantilla=False,
        estado="publicada",
        activa=True,
    )
    nueva.publicada_en = datetime.utcnow()
    nueva.historial.append(
        DietaHistorial(
            usuario_id=payload.usuario_id,
            detalle=f"Asignacion a paciente {paciente_id}",
            snapshot_data=json.dumps(_snapshot_dieta(nueva)),
        )
    )

    session.add(nueva)
    session.flush()  # asegurar que nueva.id este disponible para la asignacion

    _desactivar_asignaciones(session, paciente_id)

    asignacion = AsignacionDieta(
        dieta=nueva,
        paciente_id=paciente_id,
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
            detail="La dieta no tiene paciente asociado para generar una version.",
        )

    # Fecha de inicio/fin específicas para la nueva versión y para cerrar la anterior
    fecha_inicio_nueva = payload.fecha_inicio or date.today()
    fecha_fin_nueva = payload.fecha_fin
    # Cerrar la versión anterior en la fecha de inicio de la nueva (o hoy)
    actual.fecha_fin = fecha_inicio_nueva

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
    nueva.fecha_inicio = fecha_inicio_nueva
    nueva.fecha_fin = fecha_fin_nueva
    nueva.publicada_en = datetime.utcnow()
    detalle_version = (
        f"Nueva version: {payload.comentario}"
        if payload.comentario
        else "Nueva version generada para el paciente"
    )
    nueva.historial.append(
        DietaHistorial(
            usuario_id=payload.usuario_id,
            detalle=detalle_version,
            snapshot_data=json.dumps(_snapshot_dieta(nueva)),
        )
    )
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
            detail=f"No fue posible generar la nueva version: {exc.orig}",
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
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="La exportación de dietas (PDF/CSV) está deshabilitada."
    )


@router.post(
    "/{dieta_id}/notificar",
    status_code=status.HTTP_202_ACCEPTED,
)
def notificar_dieta(
    dieta_id: int,
    payload: DietaNotificacionRequest,
    session: Session = Depends(get_session),
):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="La notificación/publicación de dietas está deshabilitada."
    )




