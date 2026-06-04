from __future__ import annotations

from contextlib import contextmanager
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app as nutrition_app
from app.database import Base
from app.models import Alimento
from app.services import bedca, communication, export, external
from app.services import gestion as gestion_service


def _fake_dieta_for_exports():
    alimento = SimpleNamespace(
        calorias=Decimal("100"),
        proteinas=Decimal("10"),
        grasas=Decimal("5"),
        carbohidratos=Decimal("20"),
        fibra=Decimal("3"),
        micronutrientes={"hierro": 2},
    )
    ingrediente = SimpleNamespace(alimento=alimento, cantidad=Decimal("100"))
    receta = SimpleNamespace(nombre="Receta base", ingredientes=[ingrediente])
    dieta_receta = SimpleNamespace(
        receta=receta,
        dia_semana="Lunes",
        momento="Comida",
        orden=1,
        porciones=2,
    )
    return SimpleNamespace(
        id=7,
        nombre="Plan prueba",
        paciente_id="42",
        usuario_id=9,
        version=3,
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=None,
        objetivo="Subir masa",
        descripcion="Descripcion plan",
        notas="Notas plan",
        recetas=[dieta_receta],
    )


class _FakeRequestsResponse:
    def __init__(self, payload: dict | None = None, status_code: int = 200, text: str = ""):
        self._payload = payload if payload is not None else {}
        self.status_code = status_code
        self.text = text

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"status {self.status_code}")

    def json(self):
        if self._payload == "__invalid_json__":
            raise ValueError("invalid json")
        return self._payload


def test_gestion_validation_success_and_failures(monkeypatch):
    settings = SimpleNamespace(
        validate_paciente_with_gestion=True,
        gestion_service_url="http://gestion:4001/api",
        gestion_service_bearer_token="",
        gestion_service_timeout=3.0,
    )
    monkeypatch.setattr(gestion_service, "get_settings", lambda: settings)

    captured = {}

    def _fake_get_ok(url, headers, timeout):  # noqa: ARG001
        captured["url"] = url
        captured["headers"] = headers
        return _FakeRequestsResponse(payload={"idPaciente": "abc123"}, status_code=200)

    monkeypatch.setattr(gestion_service.requests, "get", _fake_get_ok)
    gestion_service.validar_paciente_en_gestion(
        "abc123",
        incoming_authorization="Bearer token-user",
    )
    assert captured["url"].endswith("/pacientes/abc123")
    assert captured["headers"]["Authorization"] == "Bearer token-user"

    monkeypatch.setattr(
        gestion_service.requests,
        "get",
        lambda *args, **kwargs: _FakeRequestsResponse(
            payload={"mensaje": "Paciente no encontrado"},
            status_code=404,
        ),
    )
    with pytest.raises(HTTPException) as not_found_exc:
        gestion_service.validar_paciente_en_gestion("missing-id")
    assert not_found_exc.value.status_code == 400

    monkeypatch.setattr(
        gestion_service.requests,
        "get",
        lambda *args, **kwargs: _FakeRequestsResponse(
            payload={"mensaje": "Token invalido"},
            status_code=401,
        ),
    )
    with pytest.raises(HTTPException) as unauthorized_exc:
        gestion_service.validar_paciente_en_gestion("abc123")
    assert unauthorized_exc.value.status_code == 401

    def _raising_get(*args, **kwargs):  # noqa: ARG001
        raise gestion_service.requests.RequestException("connection error")

    monkeypatch.setattr(gestion_service.requests, "get", _raising_get)
    with pytest.raises(HTTPException) as unavailable_exc:
        gestion_service.validar_paciente_en_gestion("abc123")
    assert unavailable_exc.value.status_code == 503


def test_gestion_validation_can_be_disabled(monkeypatch):
    settings = SimpleNamespace(
        validate_paciente_with_gestion=False,
        gestion_service_url="",
        gestion_service_bearer_token="",
        gestion_service_timeout=3.0,
    )
    monkeypatch.setattr(gestion_service, "get_settings", lambda: settings)

    called = {"count": 0}

    def _fake_get(*args, **kwargs):  # noqa: ARG001
        called["count"] += 1
        return _FakeRequestsResponse(status_code=200)

    monkeypatch.setattr(gestion_service.requests, "get", _fake_get)
    gestion_service.validar_paciente_en_gestion("abc123")
    assert called["count"] == 0


def test_external_service_parsing_and_validation(monkeypatch):
    with pytest.raises(ValueError):
        external.buscar_informacion_alimento("avena", None, "id", "key")

    def _fake_get(url, params, timeout):  # noqa: ARG001
        return _FakeRequestsResponse(
            payload={
                "hints": [
                    {
                        "food": {
                            "label": "Avena",
                            "category": "Cereal",
                            "brand": "Demo",
                            "nutrients": {
                                "ENERC_KCAL": 380,
                                "PROCNT": 14,
                                "FAT": 7,
                                "CHOCDF": 62,
                                "FIBTG": 9,
                            },
                        }
                    }
                ]
            }
        )

    monkeypatch.setattr(external.requests, "get", _fake_get)
    data = external.buscar_informacion_alimento(
        "avena",
        "https://api.example/food",
        "app-id",
        "api-key",
    )
    assert len(data) == 1
    assert data[0]["nombre"] == "Avena"
    assert data[0]["calorias"] == 380


def test_communication_service_success_invalid_json_and_errors(monkeypatch):
    dieta = _fake_dieta_for_exports()
    settings = SimpleNamespace(
        notifications_service_url="https://notify.example/send",
        notifications_service_api_key="secret-key",
        export_footer_note="Footer",
    )
    monkeypatch.setattr(communication, "get_settings", lambda: settings)
    monkeypatch.setattr(communication, "generar_pdf_dieta", lambda d, note: (b"%PDF-fake", "plan.pdf"))  # noqa: ARG005
    monkeypatch.setattr(communication, "generar_csv_dieta", lambda d: (b"col1,col2", "plan.csv"))  # noqa: ARG005

    sent_payload = {}

    def _fake_post(url, json, headers, timeout):  # noqa: ARG001
        sent_payload["payload"] = json
        sent_payload["headers"] = headers
        return _FakeRequestsResponse(payload={"status": "queued"}, status_code=202)

    monkeypatch.setattr(communication.requests, "post", _fake_post)
    result = communication.enviar_notificacion_dieta(
        dieta=dieta,
        canal="email",
        asunto=None,
        mensaje=None,
        adjuntar_pdf=True,
        adjuntar_csv=True,
        incluir_profesional=True,
    )
    assert result["status"] == "queued"
    assert sent_payload["headers"]["X-API-Key"] == "secret-key"
    assert len(sent_payload["payload"]["adjuntos"]) == 2

    monkeypatch.setattr(
        communication.requests,
        "post",
        lambda *args, **kwargs: _FakeRequestsResponse(payload="__invalid_json__", status_code=200),
    )
    no_json = communication.enviar_notificacion_dieta(
        dieta=dieta,
        canal="email",
        asunto="A",
        mensaje="B",
        adjuntar_pdf=False,
        adjuntar_csv=False,
        incluir_profesional=False,
    )
    assert no_json["status"] == "sin_respuesta_json"

    def _raising_post(*args, **kwargs):  # noqa: ARG001
        raise communication.requests.RequestException("network down")

    monkeypatch.setattr(communication.requests, "post", _raising_post)
    with pytest.raises(ValueError):
        communication.enviar_notificacion_dieta(
            dieta=dieta,
            canal="email",
            asunto="A",
            mensaje="B",
            adjuntar_pdf=False,
            adjuntar_csv=False,
            incluir_profesional=False,
        )

    monkeypatch.setattr(
        communication,
        "get_settings",
        lambda: SimpleNamespace(
            notifications_service_url="",
            notifications_service_api_key="",
            export_footer_note="Footer",
        ),
    )
    with pytest.raises(ValueError):
        communication.enviar_notificacion_dieta(
            dieta=dieta,
            canal="email",
            asunto=None,
            mensaje=None,
            adjuntar_pdf=False,
            adjuntar_csv=False,
            incluir_profesional=False,
        )


def test_export_service_generates_csv_and_pdf():
    dieta = _fake_dieta_for_exports()
    csv_bytes, csv_name = export.generar_csv_dieta(dieta)
    assert csv_name == "dieta_7_v3.csv"
    csv_text = csv_bytes.decode("utf-8-sig")
    assert "Plan prueba" in csv_text
    assert "Receta base" in csv_text

    class _FakePdf:
        def __init__(self):
            self._parts = []

        def add_page(self):
            self._parts.append("PAGE")

        def set_font(self, *args, **kwargs):  # noqa: ARG002
            return None

        def cell(self, *args, **kwargs):  # noqa: ARG002
            txt = kwargs.get("txt")
            if txt:
                self._parts.append(str(txt))

        def multi_cell(self, *args, **kwargs):  # noqa: ARG002
            txt = kwargs.get("txt")
            if txt:
                self._parts.append(str(txt))

        def ln(self, *args, **kwargs):  # noqa: ARG002
            return None

        def set_y(self, *args, **kwargs):  # noqa: ARG002
            return None

        def output(self, dest="S"):  # noqa: ARG002
            return "\n".join(self._parts) or "Plan"

    original_pdf_cls = export._PDF
    original_has_fpdf = export._HAS_FPDF
    export._PDF = _FakePdf
    export._HAS_FPDF = False
    try:
        pdf_bytes, pdf_name = export.generar_pdf_dieta(dieta, "Nota pie")
        assert pdf_name == "dieta_7_v3.pdf"
        assert isinstance(pdf_bytes, (bytes, bytearray))
        assert len(pdf_bytes) > 0
    finally:
        export._PDF = original_pdf_cls
        export._HAS_FPDF = original_has_fpdf


def test_bedca_parsing_and_sync():
    groups_xml = """<foods><food><fg_id>1</fg_id><fg_ori_name>Frutas</fg_ori_name></food></foods>"""
    foods_xml = """<foods><food><f_id>10</f_id><f_ori_name>Manzana</f_ori_name></food></foods>"""
    detail_xml = """
<foods>
  <food>
    <f_ori_name>Manzana</f_ori_name>
    <foodvalue><eur_name>ENERC_KJ</eur_name><best_location>420</best_location><v_unit>kJ</v_unit></foodvalue>
    <foodvalue><eur_name>PROT</eur_name><best_location>0.3</best_location><v_unit>g</v_unit></foodvalue>
    <foodvalue><eur_name>FAT</eur_name><best_location>0.2</best_location><v_unit>g</v_unit></foodvalue>
    <foodvalue><eur_name>CHOCDF</eur_name><best_location>11</best_location><v_unit>g</v_unit></foodvalue>
    <foodvalue><eur_name>FIBTG</eur_name><best_location>2.1</best_location><v_unit>g</v_unit></foodvalue>
  </food>
</foods>
"""

    class _FakeResponse:
        def __init__(self, content: bytes):
            self.content = content

        def raise_for_status(self):
            return None

    responses = {
        "groups": _FakeResponse(groups_xml.encode("utf-8")),
        "foods": _FakeResponse(foods_xml.encode("utf-8")),
        "detail": _FakeResponse(detail_xml.encode("utf-8")),
    }

    def _fake_post_xml(xml):
        if 'level="3"' in xml:
            return bedca.ET.fromstring(responses["groups"].content)
        if 'level="1"' in xml:
            return bedca.ET.fromstring(responses["foods"].content)
        return bedca.ET.fromstring(responses["detail"].content)

    original_post_xml = bedca._post_xml
    bedca._post_xml = _fake_post_xml
    try:
        groups = bedca.fetch_food_groups()
        assert groups[0]["nombre"] == "Frutas"

        foods = bedca.fetch_foods_in_group("1")
        assert foods[0]["id"] == "10"

        detail = bedca.fetch_food_detail("10")
        assert detail is not None
        assert detail["nombre"] == "Manzana"
        assert detail["calorias"] > 0
        assert detail["proteinas"] == 0.3
    finally:
        bedca._post_xml = original_post_xml

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()

    try:
        original_groups = bedca.fetch_food_groups
        original_foods = bedca.fetch_foods_in_group
        original_detail = bedca.fetch_food_detail
        bedca.fetch_food_groups = lambda: [{"id": "1", "nombre": "Frutas"}]
        bedca.fetch_foods_in_group = lambda group_id: [{"id": "10", "nombre": "Manzana"}]  # noqa: ARG005
        bedca.fetch_food_detail = lambda food_id: {  # noqa: ARG005
            "nombre": "Manzana",
            "calorias": 52,
            "proteinas": 0.3,
            "grasas": 0.2,
            "carbohidratos": 11,
            "fibra": 2.1,
            "unidad_base": "g",
            "descripcion": "Importado desde BEDCA",
        }

        first = bedca.sync_bedca_alimentos(session)
        assert first == {"creados": 1, "actualizados": 0}
        second = bedca.sync_bedca_alimentos(session)
        assert second == {"creados": 0, "actualizados": 1}
    finally:
        bedca.fetch_food_groups = original_groups
        bedca.fetch_foods_in_group = original_foods
        bedca.fetch_food_detail = original_detail
        session.close()
        engine.dispose()


def test_startup_with_bedca_sync_enabled(monkeypatch):
    @contextmanager
    def _fake_session_scope():
        yield SimpleNamespace()

    settings = SimpleNamespace(
        app_name="Nutricion Test",
        app_version="1.0.0",
        cors_allowed_origins=["*"],
        bedca_auto_sync=True,
    )

    calls = {"sync_called": 0, "to_thread_called": 0, "create_task_called": 0}

    monkeypatch.setattr(nutrition_app, "get_settings", lambda: settings)
    monkeypatch.setattr(nutrition_app, "session_scope", _fake_session_scope)
    monkeypatch.setattr(
        nutrition_app,
        "sync_bedca_alimentos",
        lambda session: calls.update(sync_called=calls["sync_called"] + 1),  # noqa: ARG005
    )

    async def _fake_to_thread(fn):
        calls["to_thread_called"] += 1
        fn()

    def _fake_create_task(coro):
        calls["create_task_called"] += 1
        # Ejecutamos la corrutina para cubrir el cuerpo del job.
        import asyncio

        return asyncio.get_event_loop().create_task(coro)

    monkeypatch.setattr(nutrition_app.asyncio, "to_thread", _fake_to_thread)
    monkeypatch.setattr(nutrition_app.asyncio, "create_task", _fake_create_task)

    app_instance = nutrition_app.create_app()
    with TestClient(app_instance) as client:
        response = client.get("/health")
        assert response.status_code == 200

    assert calls["create_task_called"] >= 1
    assert calls["to_thread_called"] >= 1
    assert calls["sync_called"] >= 1


def test_database_session_scope_commit_and_rollback():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    original_session_local = nutrition_app.database.SessionLocal if hasattr(nutrition_app, "database") else None
    # Import local module object to patch SessionLocal used by session_scope.
    import app.database as db_module

    previous_session_local = db_module.SessionLocal
    db_module.SessionLocal = session_factory
    try:
        with db_module.session_scope() as session:
            session.add(
                Alimento(
                    nombre="SessionScope Commit",
                    descripcion="ok",
                    calorias=100,
                    proteinas=10,
                    grasas=5,
                    carbohidratos=15,
                    fibra=2,
                    unidad_base="g",
                    micronutrientes={},
                )
            )

        with session_factory() as session:
            count_commit = session.query(Alimento).filter(Alimento.nombre == "SessionScope Commit").count()
        assert count_commit == 1

        with pytest.raises(RuntimeError):
            with db_module.session_scope() as session:
                session.add(
                    Alimento(
                        nombre="SessionScope Rollback",
                        descripcion="rollback",
                        calorias=90,
                        proteinas=9,
                        grasas=4,
                        carbohidratos=12,
                        fibra=1,
                        unidad_base="g",
                        micronutrientes={},
                    )
                )
                raise RuntimeError("forzar rollback")

        with session_factory() as session:
            count_rollback = session.query(Alimento).filter(Alimento.nombre == "SessionScope Rollback").count()
        assert count_rollback == 0
    finally:
        db_module.SessionLocal = previous_session_local
        engine.dispose()
