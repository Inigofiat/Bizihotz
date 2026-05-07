from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_session

router = APIRouter()


@router.get("/health")
def health(session: Session = Depends(get_session)):
    settings = get_settings()

    try:
        session.execute(text("SELECT 1"))
        db_status = "connected"
        status = "ok"
        http_status = 200
    except Exception as exc:  # pragma: no cover - defensivo
        db_status = f"error: {exc.__class__.__name__}"
        status = "degraded"
        http_status = 503

    return JSONResponse(
        status_code=http_status,
        content={
            "status": status,
            "app": settings.app_name,
            "version": settings.app_version,
            "db": db_status,
        },
    )
