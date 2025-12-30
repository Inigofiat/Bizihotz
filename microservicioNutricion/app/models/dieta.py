from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Dieta(Base):
    __tablename__ = "dietas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    objetivo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    calorias_objetivo: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    fecha_inicio: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    fecha_fin: Mapped[date | None] = mapped_column(Date, nullable=True)
    paciente_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    usuario_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    es_plantilla: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    estado: Mapped[str] = mapped_column(String(20), default="borrador", nullable=False)
    activa: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("dietas.id", ondelete="SET NULL"), nullable=True, index=True
    )
    publicada_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    recetas: Mapped[list["DietaReceta"]] = relationship(
        "DietaReceta",
        back_populates="dieta",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    parent: Mapped["Dieta | None"] = relationship(
        "Dieta",
        remote_side="Dieta.id",
        back_populates="children",
        foreign_keys=[parent_id],
    )
    children: Mapped[list["Dieta"]] = relationship(
        "Dieta",
        back_populates="parent",
        cascade="all, delete-orphan",
        foreign_keys="Dieta.parent_id",
    )
    historial: Mapped[list["DietaHistorial"]] = relationship(
        "DietaHistorial",
        back_populates="dieta",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    asignaciones: Mapped[list["AsignacionDieta"]] = relationship(
        "AsignacionDieta",
        back_populates="dieta",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:  # pragma: no cover - repr only
        return f"<Dieta {self.nombre} paciente={self.paciente_id}>"
