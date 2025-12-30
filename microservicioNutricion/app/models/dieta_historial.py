from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class DietaHistorial(Base):
    __tablename__ = "dietas_historial"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dieta_id: Mapped[int] = mapped_column(
        ForeignKey("dietas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    usuario_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    detalle: Mapped[str | None] = mapped_column(Text, nullable=True)
    snapshot_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    registrado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    dieta: Mapped["Dieta"] = relationship("Dieta", back_populates="historial")

    def __repr__(self) -> str:  # pragma: no cover - repr only
        return f"<DietaHistorial dieta={self.dieta_id} usuario={self.usuario_id}>"
