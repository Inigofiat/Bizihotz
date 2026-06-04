from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import JSON, DateTime, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Documento(Base):
    __tablename__ = "Documento"

    __table_args__ = (
        UniqueConstraint("fuente", "refer", name="uq_documento_fuente_refer"),
        Index("ix_documento_fuente", "fuente"),
        Index("ix_documento_tipo", "tipo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    titulo: Mapped[str] = mapped_column(String(255))
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    etiquetas: Mapped[List[str]] = mapped_column(JSON, default=list)
    tipo: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fuente: Mapped[str] = mapped_column(String(50))
    external_id: Mapped[Optional[str]] = mapped_column("refer", String(100), nullable=True)
    url_descarga: Mapped[Optional[str]] = mapped_column("url", Text, nullable=True)
    ruta_archivo: Mapped[Optional[str]] = mapped_column("rutaArchivo", Text, nullable=True)
    idioma: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    estado: Mapped[str] = mapped_column(String(20), default="activo")
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    fecha_subida: Mapped[datetime] = mapped_column(
        "fechaSubida", DateTime, default=datetime.utcnow
    )
    last_synced_at: Mapped[datetime] = mapped_column(
        "ultimaAct", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Documento id={self.id} titulo={self.titulo!r} fuente={self.fuente!r}>"
