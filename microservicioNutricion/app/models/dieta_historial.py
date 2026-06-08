from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class DietaHistorial(Base):
    __tablename__ = "HistorialDieta"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dietaId: Mapped[int] = mapped_column(
        "dietaId",
        ForeignKey("Dieta.id", ondelete="CASCADE"), nullable=False, index=True
    )
    usuarioId: Mapped[int] = mapped_column("usuarioId", Integer, nullable=False, index=True)
    detalle: Mapped[str | None] = mapped_column(Text, nullable=True)
    datos: Mapped[str | None] = mapped_column("datos", Text, nullable=True)
    registradoEn: Mapped[datetime] = mapped_column(
        "registradoEn", DateTime, default=datetime.utcnow, nullable=False
    )

    dieta: Mapped["Dieta"] = relationship("Dieta", back_populates="historial")

    def __repr__(self) -> str:  # pragma: no cover - repr only
        return f"<DietaHistorial dieta={self.dietaId} usuario={self.usuarioId}>"
