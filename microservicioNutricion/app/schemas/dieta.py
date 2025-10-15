from __future__ import annotations

from datetime import date, datetime
from typing import Dict, List, Optional

from pydantic import Field

from .base import ORMModel
from .dieta_receta import DietaRecetaCreate, DietaRecetaRead


class DietaCreate(ORMModel):
    nombre: str = Field(..., max_length=150)
    objetivo: Optional[str] = None
    descripcion: Optional[str] = None
    calorias_objetivo: Optional[float] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    paciente_id: int
    usuario_id: int
    recetas: Optional[List[DietaRecetaCreate]] = None


class DietaUpdate(ORMModel):
    nombre: Optional[str] = None
    objetivo: Optional[str] = None
    descripcion: Optional[str] = None
    calorias_objetivo: Optional[float] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    paciente_id: Optional[int] = None
    usuario_id: Optional[int] = None
    recetas: Optional[List[DietaRecetaCreate]] = None


class DietaRead(ORMModel):
    id: int
    nombre: str
    objetivo: Optional[str] = None
    descripcion: Optional[str] = None
    calorias_objetivo: Optional[float] = None
    fecha_inicio: date
    fecha_fin: Optional[date] = None
    paciente_id: int
    usuario_id: int
    creado_en: datetime
    actualizado_en: datetime
    recetas: List[DietaRecetaRead] = Field(default_factory=list)
    totales: Dict[str, float] = Field(default_factory=dict)
