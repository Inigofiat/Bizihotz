from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_session

router = APIRouter()


@router.get("/health")
def health(session: Session = Depends(get_session)):
    try:
        session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:  # pragma: no cover - defensive
        db_status = f"error: {exc.__class__.__name__}"

    return {"status": "ok", "db": db_status}
