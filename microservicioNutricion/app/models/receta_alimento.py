from __future__ import annotations

from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class RecetaAlimento(Base):
    __tablename__ = "RecetaAlimento"
    __table_args__ = (
        UniqueConstraint("recetaId", "alimentoId", name="uq_receta_alimento"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    receta_id: Mapped[int] = mapped_column(
        "recetaId", ForeignKey("Receta.id", ondelete="CASCADE"), nullable=False
    )
    alimento_id: Mapped[int] = mapped_column(
        "alimentoId", ForeignKey("Alimento.id", ondelete="CASCADE"), nullable=False
    )
    cantidad: Mapped[Decimal] = mapped_column(
        Numeric(8, 2), nullable=False, doc="Cantidad expresada en la unidad_base."
    )
    unidad: Mapped[str] = mapped_column(String(20), nullable=False, default="g")
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)

    receta: Mapped["Receta"] = relationship("Receta", back_populates="ingredientes")
    alimento: Mapped["Alimento"] = relationship("Alimento", back_populates="recetas")

    def __repr__(self) -> str:  # pragma: no cover - repr only
        return f"<RecetaAlimento receta={self.receta_id} alimento={self.alimento_id}>"
