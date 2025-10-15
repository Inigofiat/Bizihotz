from __future__ import annotations

from typing import Optional

from .alimento import AlimentoSummary
from .base import ORMModel


class RecetaIngredienteBase(ORMModel):
    alimento_id: int
    cantidad: float
    unidad: Optional[str] = None
    observaciones: Optional[str] = None


class RecetaIngredienteCreate(RecetaIngredienteBase):
    pass


class RecetaIngredienteRead(ORMModel):
    id: int
    receta_id: int
    alimento_id: int
    cantidad: float
    unidad: str
    observaciones: Optional[str] = None
    alimento: Optional[AlimentoSummary] = None
