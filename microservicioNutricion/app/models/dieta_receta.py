from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class DietaReceta(Base):
    __tablename__ = "DietaReceta"
    __table_args__ = (
        UniqueConstraint(
            "dietaId",
            "recetaId",
            "diaSemana",
            "momento",
            name="uq_dieta_receta_dia_momento",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dietaId: Mapped[int] = mapped_column(
        "dietaId",
        ForeignKey("Dieta.id", ondelete="CASCADE"), nullable=False
    )
    recetaId: Mapped[int] = mapped_column(
        "recetaId", ForeignKey("Receta.id", ondelete="CASCADE"), nullable=False
    )
    diaSemana: Mapped[str | None] = mapped_column("diaSemana", String(15), nullable=True)
    momento: Mapped[str | None] = mapped_column(
        String(30), nullable=True, doc="Ej: desayuno, almuerzo, cena, snack."
    )
    orden: Mapped[int | None] = mapped_column(Integer, nullable=True)
    porciones: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    dieta: Mapped["Dieta"] = relationship("Dieta", back_populates="recetas")
    receta: Mapped["Receta"] = relationship("Receta", back_populates="dietas")

    def __repr__(self) -> str:  # pragma: no cover - repr only
        return f"<DietaReceta dieta={self.dietaId} receta={self.recetaId}>"
