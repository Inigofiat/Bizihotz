from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import AliasChoices, Field

from .base import ORMModel
from .receta_alimento import RecetaIngredienteCreate, RecetaIngredienteRead


class RecetaBase(ORMModel):
    nombre: str = Field(..., max_length=150)
    descripcion: Optional[str] = None
    calorias_objetivo: Optional[float] = Field(
        default=None, validation_alias=AliasChoices("calorias_objetivo", "caloriasObjetivo")
    )
    instrucciones: Optional[str] = None


class RecetaCreate(RecetaBase):
    ingredientes: Optional[List[RecetaIngredienteCreate]] = None


class RecetaUpdate(ORMModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    calorias_objetivo: Optional[float] = None
    instrucciones: Optional[str] = None
    ingredientes: Optional[List[RecetaIngredienteCreate]] = None


class RecetaRead(RecetaBase):
    id: int
    creado_en: datetime = Field(validation_alias=AliasChoices("creado_en", "creadoEn"))
    actualizado_en: datetime = Field(
        validation_alias=AliasChoices("actualizado_en", "actualizadoEn")
    )
    ingredientes: List[RecetaIngredienteRead] = Field(default_factory=list)
    totales: Dict[str, Dict[str, float]] = Field(default_factory=dict)
