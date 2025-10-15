from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Receta(Base):
    __tablename__ = "recetas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    calorias_objetivo: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    instrucciones: Mapped[str | None] = mapped_column(Text, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    ingredientes: Mapped[list["RecetaAlimento"]] = relationship(
        "RecetaAlimento",
        back_populates="receta",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    dietas: Mapped[list["DietaReceta"]] = relationship(
        "DietaReceta",
        back_populates="receta",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:  # pragma: no cover - repr only
        return f"<Receta {self.nombre}>"
