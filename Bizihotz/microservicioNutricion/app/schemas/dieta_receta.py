from __future__ import annotations

from typing import Optional

from .base import ORMModel
from .receta import RecetaRead


class DietaRecetaBase(ORMModel):
    receta_id: int
    dia_semana: Optional[str] = None
    momento: Optional[str] = None
    orden: Optional[int] = None
    porciones: Optional[int] = 1


class DietaRecetaCreate(DietaRecetaBase):
    pass


class DietaRecetaRead(ORMModel):
    id: int
    dieta_id: int
    receta_id: int
    dia_semana: Optional[str] = None
    momento: Optional[str] = None
    orden: Optional[int] = None
    porciones: int = 1
    receta: Optional[RecetaRead] = None
