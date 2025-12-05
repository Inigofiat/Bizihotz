from __future__ import annotations

from sqlalchemy.orm import Session

from ..config import Settings


async def sync_fuente(
    fuente: str,
    session: Session,
    settings: Settings,
    limit: int | None = None,
) -> dict:
    """Stub mantenido por compatibilidad: las fuentes externas estan deshabilitadas."""
    raise RuntimeError("La sincronizacion con fuentes externas esta deshabilitada.")
