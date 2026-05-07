import os
from pathlib import Path

import pytest
import httpx
from fastapi.testclient import TestClient

os.environ["DATABASE_URL"] = "sqlite:///./test_documental.db"

from app import app  # noqa: E402
from app.database import Base, engine, SessionLocal, session_scope
from app.models.document import Documento
from app.routes import documentos as documentos_routes


@pytest.fixture(autouse=True)
def setup_db():
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
    assert data["db"] == "connected"


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


def test_listar_documentos_con_filtros_y_paginacion():
    client = TestClient(app)
    with SessionLocal() as session:
        docs = [
            Documento(
                titulo="Guia diabetes",
                descripcion="Recomendaciones para paciente DM2",
                etiquetas=["diabetes", "adulto"],
                tipo="pdf",
                fuente="manual",
                external_id="doc-a",
                url_descarga="https://example.com/a.pdf",
                idioma="es",
            ),
            Documento(
                titulo="Menu renal",
                descripcion="Plan para enfermedad renal cronica",
                etiquetas=["renal"],
                tipo="html",
                fuente="web",
                external_id="doc-b",
                url_descarga="https://example.com/b.html",
                idioma="es",
            ),
        ]
        session.add_all(docs)
        session.commit()

    resp_q = client.get("/api/documentos", params={"q": "renal"})
    assert resp_q.status_code == 200
    data_q = resp_q.json()
    assert len(data_q) == 1
    assert data_q[0]["titulo"] == "Menu renal"

    resp_filter = client.get(
        "/api/documentos",
        params={"fuente": "manual", "tipo": "pdf", "etiqueta": "diabetes"},
    )
    assert resp_filter.status_code == 200
    assert len(resp_filter.json()) == 1
    assert resp_filter.json()[0]["external_id"] == "doc-a"

    resp_pagination = client.get("/api/documentos", params={"skip": 0, "limit": 1})
    assert resp_pagination.status_code == 200
    assert len(resp_pagination.json()) == 1


def test_obtener_contenido_remoto_ok(monkeypatch):
    class _FakeRemoteResponse:
        def __init__(self):
            self.content = b"%PDF-1.4 fake-content"
            self.headers = {"content-type": "application/pdf"}

        def raise_for_status(self):
            return None

    class _FakeRemoteClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ARG002
            return False

        async def get(self, url):  # noqa: ARG002
            return _FakeRemoteResponse()

    monkeypatch.setattr(documentos_routes.httpx, "AsyncClient", lambda **kwargs: _FakeRemoteClient())

    with SessionLocal() as session:
        doc = Documento(
            titulo="Protocolo hospital",
            descripcion="Documento remoto",
            etiquetas=["hospital"],
            tipo="pdf",
            fuente="manual",
            external_id="doc-remote",
            url_descarga="https://example.com/path/protocolo.pdf",
            idioma="es",
        )
        session.add(doc)
        session.commit()
        session.refresh(doc)
        doc_id = doc.id

    client = TestClient(app)
    resp = client.get(f"/api/documentos/{doc_id}/contenido")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/pdf")
    assert "protocolo.pdf" in resp.headers.get("content-disposition", "")
    assert resp.content.startswith(b"%PDF")


def test_obtener_contenido_remoto_error(monkeypatch):
    class _FakeRemoteClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ARG002
            return False

        async def get(self, url):  # noqa: ARG002
            raise httpx.ConnectError("conexion fallida")

    monkeypatch.setattr(documentos_routes.httpx, "AsyncClient", lambda **kwargs: _FakeRemoteClient())

    with SessionLocal() as session:
        doc = Documento(
            titulo="Doc remoto sin acceso",
            descripcion="Documento remoto",
            etiquetas=[],
            tipo="pdf",
            fuente="manual",
            external_id="doc-remote-err",
            url_descarga="https://example.com/error.pdf",
            idioma="es",
        )
        session.add(doc)
        session.commit()
        session.refresh(doc)
        doc_id = doc.id

    client = TestClient(app)
    resp = client.get(f"/api/documentos/{doc_id}/contenido")
    assert resp.status_code == 502
    assert "No se pudo recuperar el documento" in resp.json()["detail"]


def test_obtener_contenido_local_y_errores():
    client = TestClient(app)
    test_files_dir = Path("test_files_documental")
    test_files_dir.mkdir(exist_ok=True)
    missing_file = test_files_dir / "no-existe.pdf"
    local_file = test_files_dir / "ficha.txt"
    local_file.write_text("contenido local", encoding="utf-8")

    with SessionLocal() as session:
        doc_sin_url = Documento(
            titulo="Sin URL",
            descripcion="No tiene origen",
            etiquetas=[],
            tipo="pdf",
            fuente="manual",
            external_id="doc-sin-url",
            idioma="es",
        )
        session.add(doc_sin_url)
        session.commit()
        session.refresh(doc_sin_url)
        doc_sin_url_id = doc_sin_url.id

        doc_ruta_inexistente = Documento(
            titulo="No existe",
            descripcion="ruta invalida",
            etiquetas=[],
            tipo="pdf",
            fuente="manual",
            external_id="doc-ruta-inexistente",
            ruta_archivo=str(missing_file),
            idioma="es",
        )
        session.add(doc_ruta_inexistente)
        session.commit()
        session.refresh(doc_ruta_inexistente)
        doc_ruta_inexistente_id = doc_ruta_inexistente.id

        doc_local = Documento(
            titulo="Local",
            descripcion="archivo local",
            etiquetas=[],
            tipo="txt",
            fuente="manual",
            external_id="doc-local",
            ruta_archivo=str(local_file),
            idioma="es",
        )
        session.add(doc_local)
        session.commit()
        session.refresh(doc_local)
        doc_local_id = doc_local.id

    resp_sin_url = client.get(f"/api/documentos/{doc_sin_url_id}/contenido")
    assert resp_sin_url.status_code == 404
    assert resp_sin_url.json()["detail"] == "Documento sin URL de descarga"

    resp_no_file = client.get(f"/api/documentos/{doc_ruta_inexistente_id}/contenido")
    assert resp_no_file.status_code == 404
    assert "no disponible" in resp_no_file.json()["detail"]

    resp_local = client.get(f"/api/documentos/{doc_local_id}/contenido")
    assert resp_local.status_code == 200
    assert resp_local.text == "contenido local"
    try:
        local_file.unlink(missing_ok=True)
        test_files_dir.rmdir()
    except OSError:
        pass


def test_helpers_safe_filename_and_url_resolution():
    class _Doc:
        def __init__(self, url_descarga=None, ruta_archivo=None, metadata_json=None):
            self.url_descarga = url_descarga
            self.ruta_archivo = ruta_archivo
            self.metadata_json = metadata_json

    assert documentos_routes._safe_filename("https://example.com/docs/file.pdf", "fallback") == "file.pdf"
    assert documentos_routes._safe_filename("https://example.com", 'plan"\\name') == "planname"

    assert documentos_routes._resolve_document_url(_Doc(url_descarga="https://x")) == "https://x"
    assert documentos_routes._resolve_document_url(_Doc(ruta_archivo="/tmp/doc.pdf")) == "/tmp/doc.pdf"
    assert (
        documentos_routes._resolve_document_url(_Doc(metadata_json={"url": "https://meta.example/doc"}))
        == "https://meta.example/doc"
    )
    assert documentos_routes._resolve_document_url(_Doc()) is None


def test_session_scope_commit_y_rollback():
    with session_scope() as session:
        session.add(
            Documento(
                titulo="Commit doc",
                descripcion="session_scope ok",
                etiquetas=[],
                tipo="pdf",
                fuente="manual",
                external_id="doc-commit",
                url_descarga="https://example.com/commit.pdf",
                idioma="es",
            )
        )

    with SessionLocal() as session:
        count = session.query(Documento).filter(Documento.external_id == "doc-commit").count()
    assert count == 1

    with pytest.raises(RuntimeError):
        with session_scope() as session:
            session.add(
                Documento(
                    titulo="Rollback doc",
                    descripcion="session_scope rollback",
                    etiquetas=[],
                    tipo="pdf",
                    fuente="manual",
                    external_id="doc-rollback",
                    url_descarga="https://example.com/rollback.pdf",
                    idioma="es",
                )
            )
            raise RuntimeError("forzar rollback")

    with SessionLocal() as session:
        count = session.query(Documento).filter(Documento.external_id == "doc-rollback").count()
    assert count == 0


def test_startup_event_crea_tablas():
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
