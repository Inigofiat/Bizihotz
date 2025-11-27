from __future__ import annotations

from typing import List

import requests


def buscar_informacion_alimento(
    termino: str,
    base_url: str | None,
    app_id: str | None,
    api_key: str | None,
) -> List[dict]:
    if not base_url or not app_id or not api_key:
        raise ValueError("La API externa no está configurada.")

    params = {
        "ingr": termino,
        "app_id": app_id,
        "app_key": api_key,
        "nutrition-type": "cooking",
    }
    response = requests.get(base_url, params=params, timeout=10)
    response.raise_for_status()

    data = response.json()
    hints = data.get("hints", [])
    resultados = []
    for item in hints[:5]:
        food = item.get("food", {})
        nutrients = food.get("nutrients", {})
        resultados.append(
            
            {
                "nombre": food.get("label"),
                "categoria": food.get("category"),
                "calorias": nutrients.get("ENERC_KCAL"),
                "proteinas": nutrients.get("PROCNT"),
                "grasas": nutrients.get("FAT"),
                "carbohidratos": nutrients.get("CHOCDF"),
                "fibra": nutrients.get("FIBTG"),
                "fuente": food.get("brand"),
            }
        )

    return resultados
