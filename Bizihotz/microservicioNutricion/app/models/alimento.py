from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Alimento(Base):
    __tablename__ = "alimentos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    calorias: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    proteinas: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    grasas: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    carbohidratos: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    fibra: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True, default=0)
    unidad_base: Mapped[str] = mapped_column(String(20), nullable=False, default="g")
    micronutrientes: Mapped[dict[str, float] | None] = mapped_column(
        JSON, nullable=True, default=dict
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    recetas: Mapped[list["RecetaAlimento"]] = relationship(
        "RecetaAlimento",
        back_populates="alimento",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:  # pragma: no cover - repr only
        return f"<Alimento {self.nombre}>"
