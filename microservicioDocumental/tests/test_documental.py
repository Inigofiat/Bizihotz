import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ["DATABASE_URL"] = "sqlite:///./test_documental.db"

from app import app  # noqa: E402
from app.database import Base, engine, SessionLocal
from app.models.document import Documento


@pytest.fixture(autouse=True)
def setup_db(tmp_path):
    # recrear base en SQLite local de pruebas
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    db_path = Path("test_documental.db")
    if db_path.exists():
        try:
            db_path.unlink()
        except PermissionError:
            pass


def test_health():
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


def test_listar_y_obtener_documento():
    client = TestClient(app)
    # Insertar documento de prueba
    with SessionLocal() as session:
        doc = Documento(
            titulo="Guía nutricional",
            descripcion="Documento de prueba",
            etiquetas=["nutricion", "guia"],
            tipo="pdf",
            fuente="manual",
            external_id="doc-1",
            url_descarga="https://example.com/doc.pdf",
            idioma="es",
        )
        session.add(doc)
        session.commit()
        session.refresh(doc)
        doc_id = doc.id

    # Listar documentos
    resp = client.get("/api/documentos")
    assert resp.status_code == 200
    docs = resp.json()
    assert len(docs) == 1
    assert docs[0]["titulo"] == "Guía nutricional"

    # Obtener por id
    resp = client.get(f"/api/documentos/{doc_id}")
    assert resp.status_code == 200
    detalle = resp.json()
    assert detalle["id"] == doc_id
    assert detalle["fuente"] == "manual"


def test_documento_no_encontrado():
    client = TestClient(app)
    resp = client.get("/api/documentos/9999")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Documento no encontrado"
