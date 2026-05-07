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

    paciente_id = "99"
    asignacion_resp = client.post(
        f"/api/dietas/{plantilla_id}/asignaciones",
        json={"paciente_id": paciente_id, "usuario_id": 1, "comentario": "Plan inicial"},
    )
    assert asignacion_resp.status_code == 201
    asignacion = asignacion_resp.json()
    assert asignacion["paciente_id"] == paciente_id
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
    assert export_csv.status_code == 501
    assert "deshabilitada" in export_csv.json()["detail"].lower()


def test_crud_dieta_historial_filtros_y_notificacion(client: TestClient):
    alimento_id = _crear_alimento(client)
    receta_id = _crear_receta(client, alimento_id)

    crear = client.post(
        "/api/dietas",
        json={
            "nombre": "Plan paciente directo",
            "objetivo": "Recomposicion corporal",
            "descripcion": "Dieta personalizada inicial",
            "usuario_id": 2,
            "paciente_id": "P-200",
            "es_plantilla": False,
            "estado": "publicada",
            "recetas": [
                {
                    "receta_id": receta_id,
                    "dia_semana": "Martes",
                    "momento": "Comida",
                    "orden": 1,
                    "porciones": 2,
                }
            ],
        },
    )
    assert crear.status_code == 201
    dieta = crear.json()
    dieta_id = dieta["id"]
    assert dieta["paciente_id"] == "P-200"
    assert dieta["activa"] is True
    assert dieta["historial"]

    listar = client.get("/api/dietas", params={"paciente_id": "P-200", "estado": "publicada"})
    assert listar.status_code == 200
    assert any(item["id"] == dieta_id for item in listar.json())

    detalle = client.get(f"/api/dietas/{dieta_id}")
    assert detalle.status_code == 200
    historial_entries = detalle.json()["historial"]
    assert historial_entries
    historial_id = historial_entries[0]["id"]

    actualizar = client.put(
        f"/api/dietas/{dieta_id}",
        json={
            "usuario_id": 2,
            "nombre": "Plan paciente actualizado",
            "notas": "Actualizar hidratacion",
            "activa": True,
            "recetas": [
                {
                    "receta_id": receta_id,
                    "dia_semana": "Miercoles",
                    "momento": "Cena",
                    "orden": 2,
                    "porciones": 1,
                }
            ],
        },
    )
    assert actualizar.status_code == 200
    assert actualizar.json()["nombre"] == "Plan paciente actualizado"
    assert len(actualizar.json()["historial"]) >= 1

    borrar_historial = client.delete(f"/api/dietas/{dieta_id}/historial/{historial_id}")
    assert borrar_historial.status_code == 204

    notificar = client.post(
        f"/api/dietas/{dieta_id}/notificar",
        json={"canal": "email", "adjuntar_pdf": True, "adjuntar_csv": False},
    )
    assert notificar.status_code == 501
    assert "deshabilitada" in notificar.json()["detail"].lower()

    eliminar = client.delete(f"/api/dietas/{dieta_id}")
    assert eliminar.status_code == 204

    obtener_borrada = client.get(f"/api/dietas/{dieta_id}")
    assert obtener_borrada.status_code == 404


def test_dietas_errores_de_validacion_y_versionado(client: TestClient):
    alimento_id = _crear_alimento(client)
    receta_id = _crear_receta(client, alimento_id)
    plantilla_id = _crear_plantilla(client, receta_id)

    personalizada_sin_paciente = client.post(
        "/api/dietas",
        json={
            "nombre": "Sin paciente",
            "usuario_id": 1,
            "es_plantilla": False,
            "recetas": [{"receta_id": receta_id}],
        },
    )
    assert personalizada_sin_paciente.status_code == 400

    versionar_plantilla = client.post(
        f"/api/dietas/{plantilla_id}/versionar",
        json={"usuario_id": 1, "comentario": "No permitido"},
    )
    assert versionar_plantilla.status_code == 400

    asignar = client.post(
        f"/api/dietas/{plantilla_id}/asignaciones",
        json={"paciente_id": "P-300", "usuario_id": 1},
    )
    assert asignar.status_code == 201
    asignada_id = asignar.json()["id"]

    reasignar_otro_paciente = client.post(
        f"/api/dietas/{asignada_id}/asignaciones",
        json={"paciente_id": "P-301", "usuario_id": 1},
    )
    assert reasignar_otro_paciente.status_code == 409

    historial_inexistente = client.delete(f"/api/dietas/{asignada_id}/historial/99999")
    assert historial_inexistente.status_code == 404
