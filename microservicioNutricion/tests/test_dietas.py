from __future__ import annotations

from fastapi.testclient import TestClient


def _crear_alimento(client: TestClient) -> int:
    respuesta = client.post(
        "/api/alimentos",
        json={
            "nombre": "Avena integral",
            "descripcion": "Cereal completo",
            "calorias": 389,
            "proteinas": 16.9,
            "grasas": 6.9,
            "carbohidratos": 66.3,
            "fibra": 10.6,
            "unidad_base": "g",
            "micronutrientes": {"hierro": 5.0, "magnesio": 177.0},
        },
    )
    assert respuesta.status_code == 201
    return respuesta.json()["id"]


def _crear_receta(client: TestClient, alimento_id: int) -> int:
    respuesta = client.post(
        "/api/recetas",
        json={
            "nombre": "Desayuno energético",
            "descripcion": "Avena con fruta",
            "instrucciones": "Mezclar y servir frío.",
            "ingredientes": [
                {"alimento_id": alimento_id, "cantidad": 80, "unidad": "g"}
            ],
        },
    )
    assert respuesta.status_code == 201
    return respuesta.json()["id"]


def _crear_plantilla(client: TestClient, receta_id: int) -> int:
    respuesta = client.post(
        "/api/dietas",
        json={
            "nombre": "Plan semanal base",
            "objetivo": "Control de peso",
            "descripcion": "Plantilla inicial para pacientes nuevos",
            "usuario_id": 1,
            "es_plantilla": True,
            "recetas": [
                {
                    "receta_id": receta_id,
                    "dia_semana": "Lunes",
                    "momento": "Desayuno",
                    "orden": 1,
                    "porciones": 1,
                }
            ],
        },
    )
    assert respuesta.status_code == 201
    return respuesta.json()["id"]


def test_asignacion_versionado_y_exportacion(client: TestClient):
    alimento_id = _crear_alimento(client)
    receta_id = _crear_receta(client, alimento_id)
    plantilla_id = _crear_plantilla(client, receta_id)

    asignacion_resp = client.post(
        f"/api/dietas/{plantilla_id}/asignaciones",
        json={"paciente_id": 99, "usuario_id": 1, "comentario": "Plan inicial"},
    )
    assert asignacion_resp.status_code == 201
    asignacion = asignacion_resp.json()
    assert asignacion["paciente_id"] == 99
    assert asignacion["es_plantilla"] is False
    assert asignacion["version"] == 1
    assert asignacion["totales"]["macros"]["calorias"] > 0
    assert asignacion["totales"]["micros"]["hierro"] > 0
    assert len(asignacion["asignaciones"]) == 1
    assert asignacion["asignaciones"][0]["es_actual"] is True

    version_resp = client.post(
        f"/api/dietas/{asignacion['id']}/versionar",
        json={
            "usuario_id": 1,
            "comentario": "Ajuste semanal",
            "notas": "Agregar recordatorio de hidratación",
        },
    )
    assert version_resp.status_code == 201
    nueva_version = version_resp.json()
    assert nueva_version["version"] == 2
    assert nueva_version["activa"] is True
    assert len(nueva_version["asignaciones"]) == 1
    assert nueva_version["asignaciones"][0]["version"] == 2

    historico_resp = client.get(f"/api/dietas/{asignacion['id']}")
    assert historico_resp.status_code == 200
    historico = historico_resp.json()
    assert historico["activa"] is False
    assert historico["estado"] == "historica"

    export_csv = client.get(
        f"/api/dietas/{nueva_version['id']}/exportar", params={"formato": "csv"}
    )
    assert export_csv.status_code == 200
    assert export_csv.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=" in export_csv.headers["content-disposition"].lower()
    assert "Totales dieta" in export_csv.text
