from __future__ import annotations

from typing import Optional

from pydantic import AliasChoices, Field

from .alimento import AlimentoSummary
from .base import ORMModel


class RecetaIngredienteBase(ORMModel):
    alimento_id: int = Field(validation_alias=AliasChoices("alimento_id", "alimentoId"))
    cantidad: float
    unidad: Optional[str] = None
    observaciones: Optional[str] = None


class RecetaIngredienteCreate(RecetaIngredienteBase):
    pass


class RecetaIngredienteRead(ORMModel):
    id: int
    receta_id: int = Field(validation_alias=AliasChoices("receta_id", "recetaId"))
    alimento_id: int = Field(validation_alias=AliasChoices("alimento_id", "alimentoId"))
    cantidad: float
    unidad: str
    observaciones: Optional[str] = None
    alimento: Optional[AlimentoSummary] = None
