from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class AsignacionDieta(Base):
    __tablename__ = "DietaAsignacion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dietaId: Mapped[int] = mapped_column(
        "dietaId",
        ForeignKey("Dieta.id", ondelete="CASCADE"), nullable=False
    )
    pacienteId: Mapped[str] = mapped_column("pacienteId", String(128), nullable=False, index=True)
    usuarioId: Mapped[int] = mapped_column("usuarioId", Integer, nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    esActual: Mapped[bool] = mapped_column("esActual", Boolean, default=True, nullable=False)
    fechaAsignacion: Mapped[datetime] = mapped_column(
        "fechaAsignacion", DateTime, default=datetime.utcnow, nullable=False
    )
    notificadoEn: Mapped[datetime | None] = mapped_column(
        "notificadoEn", DateTime, nullable=True
    )
    comentario: Mapped[str | None] = mapped_column(Text, nullable=True)

    dieta: Mapped["Dieta"] = relationship("Dieta", back_populates="asignaciones")

    def __repr__(self) -> str:  # pragma: no cover - repr only
        return (
            f"<AsignacionDieta dieta={self.dietaId} paciente={self.pacienteId} "
            f"version={self.version}>"
        )
