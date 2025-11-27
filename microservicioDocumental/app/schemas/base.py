from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Base de modelos Pydantic preparada para objetos ORM."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @classmethod
    def from_orm(cls, obj):  # type: ignore[override]
        """Compatibilidad con `from_orm` de Pydantic v1."""
        return cls.model_validate(obj, from_attributes=True)
