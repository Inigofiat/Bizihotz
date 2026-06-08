from __future__ import annotations

from datetime import date, datetime
from typing import Dict, List, Literal, Optional

from pydantic import AliasChoices, Field

from .base import ORMModel
from .dieta_receta import DietaRecetaCreate, DietaRecetaRead


class DietaBase(ORMModel):
    nombre: str = Field(..., max_length=150)
    objetivo: Optional[str] = None
    descripcion: Optional[str] = None
    calorias_objetivo: Optional[float] = Field(
        default=None, validation_alias=AliasChoices("calorias_objetivo", "caloriasObjetivo")
    )
    fecha_inicio: Optional[date] = Field(
        default=None, validation_alias=AliasChoices("fecha_inicio", "fechaInicio")
    )
    fecha_fin: Optional[date] = Field(
        default=None, validation_alias=AliasChoices("fecha_fin", "fechaFin")
    )
    notas: Optional[str] = None


class DietaCreate(DietaBase):
    paciente_id: Optional[str] = None
    usuario_id: int
    es_plantilla: bool = False
    parent_id: Optional[int] = None
    estado: Optional[str] = Field(default="borrador", max_length=20)
    activa: Optional[bool] = None
    recetas: Optional[List[DietaRecetaCreate]] = None


class DietaUpdate(ORMModel):
    nombre: Optional[str] = None
    objetivo: Optional[str] = None
    descripcion: Optional[str] = None
    calorias_objetivo: Optional[float] = Field(
        default=None, validation_alias=AliasChoices("calorias_objetivo", "caloriasObjetivo")
    )
    fecha_inicio: Optional[date] = Field(
        default=None, validation_alias=AliasChoices("fecha_inicio", "fechaInicio")
    )
    fecha_fin: Optional[date] = Field(
        default=None, validation_alias=AliasChoices("fecha_fin", "fechaFin")
    )
    notas: Optional[str] = None
    paciente_id: Optional[str] = None
    usuario_id: Optional[int] = None
    actor_usuario_id: Optional[int] = None
    es_plantilla: Optional[bool] = None
    estado: Optional[str] = None
    activa: Optional[bool] = None
    parent_id: Optional[int] = None
    recetas: Optional[List[DietaRecetaCreate]] = None


class DietaVersionPayload(ORMModel):
    usuario_id: int
    nombre: Optional[str] = None
    objetivo: Optional[str] = None
    descripcion: Optional[str] = None
    calorias_objetivo: Optional[float] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    notas: Optional[str] = None
    recetas: Optional[List[DietaRecetaCreate]] = None
    comentario: Optional[str] = None


class DietaAsignacionCreate(DietaVersionPayload):
    paciente_id: str


class DietaNotificacionRequest(ORMModel):
    canal: Literal["email", "whatsapp", "sms", "push"] = "email"
    asunto: Optional[str] = None
    mensaje: Optional[str] = None
    adjuntar_pdf: bool = True
    adjuntar_csv: bool = False
    enviar_copia_profesional: bool = False


class DietaAsignacionRead(ORMModel):
    id: int
    paciente_id: str = Field(validation_alias=AliasChoices("paciente_id", "pacienteId"))
    usuario_id: int = Field(validation_alias=AliasChoices("usuario_id", "usuarioId"))
    version: int
    es_actual: bool = Field(validation_alias=AliasChoices("es_actual", "esActual"))
    fecha_asignacion: datetime = Field(
        validation_alias=AliasChoices("fecha_asignacion", "fechaAsignacion")
    )
    notificado_en: Optional[datetime] = Field(
        default=None, validation_alias=AliasChoices("notificado_en", "notificadoEn")
    )
    comentario: Optional[str] = None


class DietaHistorialRead(ORMModel):
    id: int
    dieta_id: int = Field(validation_alias=AliasChoices("dieta_id", "dietaId"))
    usuario_id: int = Field(validation_alias=AliasChoices("usuario_id", "usuarioId"))
    detalle: Optional[str] = None
    snapshot: Optional[Dict] = None
    registrado_en: datetime = Field(
        validation_alias=AliasChoices("registrado_en", "registradoEn")
    )


class DietaRead(ORMModel):
    id: int
    nombre: str
    objetivo: Optional[str] = None
    descripcion: Optional[str] = None
    calorias_objetivo: Optional[float] = Field(
        default=None, validation_alias=AliasChoices("calorias_objetivo", "caloriasObjetivo")
    )
    fecha_inicio: Optional[date] = Field(
        default=None, validation_alias=AliasChoices("fecha_inicio", "fechaInicio")
    )
    fecha_fin: Optional[date] = Field(
        default=None, validation_alias=AliasChoices("fecha_fin", "fechaFin")
    )
    notas: Optional[str] = None
    paciente_id: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("paciente_id", "pacienteId")
    )
    usuario_id: int = Field(validation_alias=AliasChoices("usuario_id", "usuarioId"))
    es_plantilla: bool = Field(validation_alias=AliasChoices("es_plantilla", "esPlantilla"))
    version: int
    estado: str
    activa: bool
    parent_id: Optional[int] = Field(
        default=None, validation_alias=AliasChoices("parent_id", "idPadre")
    )
    publicada_en: Optional[datetime] = Field(
        default=None, validation_alias=AliasChoices("publicada_en", "publicadaEn")
    )
    creado_en: datetime = Field(validation_alias=AliasChoices("creado_en", "creadoEn"))
    actualizado_en: datetime = Field(
        validation_alias=AliasChoices("actualizado_en", "acutalizadoEn")
    )
    recetas: List[DietaRecetaRead] = Field(default_factory=list)
    totales: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    asignaciones: List[DietaAsignacionRead] = Field(default_factory=list)
    historial: List[DietaHistorialRead] = Field(default_factory=list)
