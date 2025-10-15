from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import Field

from .base import ORMModel


class AlimentoBase(ORMModel):
    nombre: str = Field(..., max_length=120)
    descripcion: Optional[str] = None
    calorias: float
    proteinas: float
    grasas: float
    carbohidratos: float
    fibra: float = 0.0
    unidad_base: str = Field(default="g", max_length=20)


class AlimentoCreate(AlimentoBase):
    pass


class AlimentoUpdate(AlimentoBase):
    pass


class AlimentoSummary(ORMModel):
    id: int
    nombre: str
    calorias: float
    proteinas: float
    grasas: float
    carbohidratos: float
    fibra: float
    unidad_base: str


class AlimentoRead(AlimentoBase):
    id: int
    creado_en: datetime
    actualizado_en: datetime
