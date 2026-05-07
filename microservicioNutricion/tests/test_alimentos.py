from __future__ import annotations


def _payload_alimento(nombre: str = "Avena integral") -> dict:
    return {
        "nombre": nombre,
        "descripcion": "Cereal completo",
        "calorias": 389,
        "proteinas": 16.9,
        "grasas": 6.9,
        "carbohidratos": 66.3,
        "fibra": 10.6,
        "unidad_base": "g",
        "micronutrientes": {"hierro": 5.0},
    }


def test_crud_alimentos_y_busqueda(client):
    crear = client.post("/api/alimentos", json=_payload_alimento("Avena"))
    assert crear.status_code == 201
    alimento_id = crear.json()["id"]

    duplicado = client.post("/api/alimentos", json=_payload_alimento("Avena"))
    assert duplicado.status_code == 409
    assert "ya existe" in duplicado.json()["detail"].lower()

    listado = client.get("/api/alimentos")
    assert listado.status_code == 200
    assert len(listado.json()) == 1

    filtrado = client.get("/api/alimentos", params={"buscar": "aven"})
    assert filtrado.status_code == 200
    assert len(filtrado.json()) == 1

    detalle = client.get(f"/api/alimentos/{alimento_id}")
    assert detalle.status_code == 200
    assert detalle.json()["nombre"] == "Avena"

    actualizar = client.put(
        f"/api/alimentos/{alimento_id}",
        json=_payload_alimento("Avena actualizada"),
    )
    assert actualizar.status_code == 200
    assert actualizar.json()["nombre"] == "Avena actualizada"

    no_existe = client.get("/api/alimentos/9999")
    assert no_existe.status_code == 404
    assert "no encontrado" in no_existe.json()["detail"].lower()

    eliminar = client.delete(f"/api/alimentos/{alimento_id}")
    assert eliminar.status_code == 204

    tras_borrado = client.get(f"/api/alimentos/{alimento_id}")
    assert tras_borrado.status_code == 404


def test_sync_bedca_ok_y_error(client, monkeypatch):
    monkeypatch.setattr(
        "app.routes.alimentos.sync_bedca_alimentos",
        lambda session: {"creados": 2, "actualizados": 1},
    )
    ok = client.post("/api/alimentos/bedca/sync")
    assert ok.status_code == 200
    assert ok.json() == {"creados": 2, "actualizados": 1}

    def _raise(_session):
        raise RuntimeError("bedca offline")

    monkeypatch.setattr("app.routes.alimentos.sync_bedca_alimentos", _raise)
    err = client.post("/api/alimentos/bedca/sync")
    assert err.status_code == 502
    assert "bedca offline" in err.json()["detail"].lower()

