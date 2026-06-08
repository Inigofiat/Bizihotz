from __future__ import annotations

from typing import Optional

from pydantic import AliasChoices, Field

from .base import ORMModel
from .receta import RecetaRead


class DietaRecetaBase(ORMModel):
    receta_id: int = Field(validation_alias=AliasChoices("receta_id", "recetaId"))
    dia_semana: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("dia_semana", "diaSemana")
    )
    momento: Optional[str] = None
    orden: Optional[int] = None
    porciones: Optional[int] = 1


class DietaRecetaCreate(DietaRecetaBase):
    pass


class DietaRecetaRead(ORMModel):
    id: int
    dieta_id: int = Field(validation_alias=AliasChoices("dieta_id", "dietaId"))
    receta_id: int = Field(validation_alias=AliasChoices("receta_id", "recetaId"))
    dia_semana: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("dia_semana", "diaSemana")
    )
    momento: Optional[str] = None
    orden: Optional[int] = None
    porciones: int = 1
    receta: Optional[RecetaRead] = None
