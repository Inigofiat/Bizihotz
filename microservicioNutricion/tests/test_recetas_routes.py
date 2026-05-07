from __future__ import annotations


def _alimento_payload(nombre: str) -> dict:
    return {
        "nombre": nombre,
        "descripcion": "Base test",
        "calorias": 100,
        "proteinas": 10,
        "grasas": 5,
        "carbohidratos": 12,
        "fibra": 2,
        "unidad_base": "g",
        "micronutrientes": {"calcio": 30},
    }


def _crear_alimento(client, nombre: str) -> int:
    resp = client.post("/api/alimentos", json=_alimento_payload(nombre))
    assert resp.status_code == 201
    return resp.json()["id"]


def test_crud_recetas_y_validaciones(client):
    alimento_a = _crear_alimento(client, "Pollo")
    alimento_b = _crear_alimento(client, "Arroz")

    crear = client.post(
        "/api/recetas",
        json={
            "nombre": "Pollo con arroz",
            "descripcion": "Receta base",
            "instrucciones": "Cocer y mezclar",
            "ingredientes": [
                {"alimento_id": alimento_a, "cantidad": 120, "unidad": "g"},
                {"alimento_id": alimento_b, "cantidad": 80, "unidad": "g"},
            ],
        },
    )
    assert crear.status_code == 201
    receta_id = crear.json()["id"]
    assert len(crear.json()["ingredientes"]) == 2

    listar = client.get("/api/recetas")
    assert listar.status_code == 200
    assert len(listar.json()) == 1

    buscar = client.get("/api/recetas", params={"buscar": "pollo"})
    assert buscar.status_code == 200
    assert len(buscar.json()) == 1

    detalle = client.get(f"/api/recetas/{receta_id}")
    assert detalle.status_code == 200
    assert detalle.json()["nombre"] == "Pollo con arroz"

    actualizar = client.put(
        f"/api/recetas/{receta_id}",
        json={
            "nombre": "Pollo con arroz actualizado",
            "ingredientes": [
                {"alimento_id": alimento_a, "cantidad": 150, "unidad": "g"},
            ],
        },
    )
    assert actualizar.status_code == 200
    assert actualizar.json()["nombre"] == "Pollo con arroz actualizado"
    assert len(actualizar.json()["ingredientes"]) == 1

    duplicados = client.put(
        f"/api/recetas/{receta_id}",
        json={
            "ingredientes": [
                {"alimento_id": alimento_a, "cantidad": 50, "unidad": "g"},
                {"alimento_id": alimento_a, "cantidad": 40, "unidad": "g"},
            ],
        },
    )
    assert duplicados.status_code == 400
    assert "duplicados" in duplicados.json()["detail"].lower()

    cantidad_invalida = client.put(
        f"/api/recetas/{receta_id}",
        json={"ingredientes": [{"alimento_id": alimento_a, "cantidad": 0, "unidad": "g"}]},
    )
    assert cantidad_invalida.status_code == 400
    assert "mayor a cero" in cantidad_invalida.json()["detail"].lower()

    no_existe_alimento = client.post(
        "/api/recetas",
        json={
            "nombre": "Receta invalida",
            "ingredientes": [{"alimento_id": 9999, "cantidad": 90, "unidad": "g"}],
        },
    )
    assert no_existe_alimento.status_code == 404

    receta_no_encontrada = client.get("/api/recetas/9999")
    assert receta_no_encontrada.status_code == 404

    eliminar = client.delete(f"/api/recetas/{receta_id}")
    assert eliminar.status_code == 204

    tras_borrado = client.get(f"/api/recetas/{receta_id}")
    assert tras_borrado.status_code == 404

