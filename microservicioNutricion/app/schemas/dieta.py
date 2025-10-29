from __future__ import annotations

from datetime import date, datetime
from typing import Dict, List, Literal, Optional

from pydantic import Field

from .base import ORMModel
from .dieta_receta import DietaRecetaCreate, DietaRecetaRead


class DietaBase(ORMModel):
    nombre: str = Field(..., max_length=150)
    objetivo: Optional[str] = None
    descripcion: Optional[str] = None
    calorias_objetivo: Optional[float] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    notas: Optional[str] = None


class DietaCreate(DietaBase):
    paciente_id: Optional[int] = None
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
    calorias_objetivo: Optional[float] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    notas: Optional[str] = None
    paciente_id: Optional[int] = None
    usuario_id: Optional[int] = None
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
    paciente_id: int


class DietaNotificacionRequest(ORMModel):
    canal: Literal["email", "whatsapp", "sms", "push"] = "email"
    asunto: Optional[str] = None
    mensaje: Optional[str] = None
    adjuntar_pdf: bool = True
    adjuntar_csv: bool = False
    enviar_copia_profesional: bool = False


class DietaAsignacionRead(ORMModel):
    id: int
    paciente_id: int
    usuario_id: int
    version: int
    es_actual: bool
    fecha_asignacion: datetime
    notificado_en: Optional[datetime] = None
    comentario: Optional[str] = None


class DietaRead(ORMModel):
    id: int
    nombre: str
    objetivo: Optional[str] = None
    descripcion: Optional[str] = None
    calorias_objetivo: Optional[float] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    notas: Optional[str] = None
    paciente_id: Optional[int] = None
    usuario_id: int
    es_plantilla: bool
    version: int
    estado: str
    activa: bool
    parent_id: Optional[int] = None
    publicada_en: Optional[datetime] = None
    creado_en: datetime
    actualizado_en: datetime
    recetas: List[DietaRecetaRead] = Field(default_factory=list)
    totales: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    asignaciones: List[DietaAsignacionRead] = Field(default_factory=list)
