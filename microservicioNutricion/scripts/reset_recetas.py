"""
Reset y siembra de recetas variada (desayuno, comida, cena) usando los
alimentos realmente disponibles en la BD. No se añade ningún campo extra
en las recetas: solo nombre, descripción, instrucciones e ingredientes.

Uso:
    python microservicioNutricion/scripts/reset_recetas.py

Requisitos:
    pip install requests
"""

from __future__ import annotations

import random
import sys
from typing import Any, Dict, List, Optional, Tuple

import requests

API_BASE = "http://localhost:5002/api"
TARGET_RECIPES = 36  # apunta a 36+ para cubrir variedad
random.seed(42)


def get(path: str) -> Any:
    resp = requests.get(f"{API_BASE}{path}", timeout=10)
    resp.raise_for_status()
    return resp.json()


def delete(path: str) -> None:
    resp = requests.delete(f"{API_BASE}{path}", timeout=10)
    if resp.status_code not in (200, 204):
        resp.raise_for_status()


def post(path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    resp = requests.post(f"{API_BASE}{path}", json=payload, timeout=10)
    resp.raise_for_status()
    return resp.json()


def resolve_alimentos(
    alimentos: List[Dict[str, Any]]
) -> Tuple[Dict[str, Dict[str, Any]], Dict[Any, Dict[str, Any]]]:
    name_map: Dict[str, Dict[str, Any]] = {}
    id_map: Dict[Any, Dict[str, Any]] = {}
    for item in alimentos:
        nombre = (item.get("nombre") or "").strip().lower()
        if not nombre:
            continue
        item_id = item.get("id") or item.get("alimento_id") or item.get("_id")
        name_map[nombre] = item
        if item_id is not None:
            id_map[item_id] = item
    return name_map, id_map


def filter_by_keywords(alimentos_map: Dict[str, Dict[str, Any]], keywords: List[str]) -> List[Dict[str, Any]]:
    res = []
    for name, item in alimentos_map.items():
        lname = name.lower()
        if any(k in lname for k in keywords):
            res.append(item)
    return res


def pick(alist: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not alist:
        return None
    return random.choice(alist)


def name_from_items(items: List[Dict[str, Any]]) -> str:
    base = [i.get("nombre", "").split()[0] for i in items if i.get("nombre")]
    clean = [b.capitalize() for b in base[:3] if b]
    return " ".join(clean) or "Receta"


def compute_kcal(ingredientes: List[Dict[str, Any]], id_map: Dict[Any, Dict[str, Any]]) -> Optional[float]:
    total = 0.0
    found = False
    for ing in ingredientes:
        alimento = id_map.get(ing.get("alimento_id"))
        if not alimento:
            continue
        kcal_100 = float(alimento.get("calorias") or 0)
        cantidad = float(ing.get("cantidad") or 0)
        unidad = (ing.get("unidad") or "").lower()
        # Suponemos que calorias se expresan por 100 g o 100 ml; si la unidad no es g, igualmente escalamos
        total += kcal_100 * (cantidad / 100.0)
        found = True
    return round(total, 0) if found else None


def make_ing(item: Dict[str, Any], qty: float) -> Dict[str, Any]:
    return {
        "alimento_id": item.get("id") or item.get("alimento_id") or item.get("_id"),
        "cantidad": qty,
        "unidad": item.get("unidad_base") or "g",
    }


def build_recipe_from_ings(
    ingredientes: List[Dict[str, Any]],
    nombre_ref: List[Dict[str, Any]],
    *,
    id_map: Dict[Any, Dict[str, Any]],
) -> Dict[str, Any]:
    if not ingredientes or not all(ing.get("alimento_id") for ing in ingredientes):
        return {}
    nombre = name_from_items(nombre_ref)
    kcal = compute_kcal(ingredientes, id_map)
    return {
        "nombre": nombre,
        "descripcion": f"Combinación de {len(ingredientes)} ingredientes.",
        "instrucciones": "Mezcla los ingredientes y ajusta condimentos al gusto.",
        "ingredientes": ingredientes,
        "calorias_objetivo": kcal,
    }


def main() -> None:
    try:
        alimentos = get("/alimentos")
    except Exception as exc:  # pragma: no cover
        sys.exit(f"No se pudieron obtener alimentos: {exc}")

    if not isinstance(alimentos, list) or not alimentos:
        sys.exit("No hay alimentos disponibles en la base.")

    amap, id_map = resolve_alimentos(alimentos)

    proteins = filter_by_keywords(amap, ["pollo", "pavo", "ternera", "vaca", "res", "cerdo", "cordero", "jamon", "ató", "atun", "salm", "pesc", "huevo"])
    carbs = filter_by_keywords(amap, ["arroz", "pasta", "quinoa", "avena", "patata", "papa", "boniato", "batata", "pan", "tortilla", "garbanzo", "lenteja", "alubia"])
    greens = filter_by_keywords(amap, ["ensalada", "lechuga", "espinaca", "brocoli", "verdura", "col", "repollo", "pepino", "pimiento", "tomate", "zanahoria"])
    fruits = filter_by_keywords(amap, ["manzana", "platano", "banana", "pera", "naranja", "mango", "fruta", "kiwi"])
    dairy = filter_by_keywords(amap, ["yogur", "queso", "leche", "kefir"])
    fats = filter_by_keywords(amap, ["aguacate", "aceite", "nuez", "almendra", "cacahuate", "pistacho", "semilla"])

    # Limpiar recetas existentes
    try:
        recetas = get("/recetas")
        if isinstance(recetas, list):
            for rec in recetas:
                rec_id = rec.get("id") or rec.get("receta_id")
                if rec_id:
                    delete(f"/recetas/{rec_id}")
    except Exception as exc:  # pragma: no cover
        sys.exit(f"No se pudieron borrar recetas existentes: {exc}")

    created = 0
    attempts = 0
    max_attempts = TARGET_RECIPES * 3

    # Genera recetas variadas: desayunos (carb+dairy+fruit), comidas/cenas (protein+carb+veg+fat)
    while created < TARGET_RECIPES and attempts < max_attempts:
        attempts += 1
        if created < 12:  # más hacia desayuno
            carb = pick(carbs)
            dair = pick(dairy)
            fruit = pick(fruits)
            fat = pick(fats)
            ings = [
                make_ing(carb, 60) if carb else None,
                make_ing(dair, 200) if dair else None,
                make_ing(fruit, 120) if fruit else None,
            ]
            if fat:
                ings.append(make_ing(fat, 10))
            name_ref = [x for x in [carb, dair, fruit] if x]
        elif created < 24:  # comidas
            prot = pick(proteins)
            carb = pick(carbs)
            veg = pick(greens)
            fat = pick(fats)
            ings = [
                make_ing(prot, 150) if prot else None,
                make_ing(carb, 150) if carb else None,
                make_ing(veg, 120) if veg else None,
            ]
            if fat:
                ings.append(make_ing(fat, 10))
            name_ref = [x for x in [prot, carb, veg] if x]
        else:  # cenas
            prot = pick(proteins)
            veg = pick(greens)
            carb = pick(carbs)
            fat = pick(fats)
            ings = [
                make_ing(prot, 140) if prot else None,
                make_ing(veg, 150) if veg else None,
            ]
            if carb:
                ings.append(make_ing(carb, 80))
            if fat:
                ings.append(make_ing(fat, 10))
            name_ref = [x for x in [prot, veg, carb] if x]

        ing_list = [i for i in ings if i and i.get("alimento_id")]
        recipe = build_recipe_from_ings(ing_list, name_ref, id_map=id_map)
        if not recipe or len(recipe["ingredientes"]) < 2:
            continue
        try:
            post("/recetas", recipe)
            created += 1
        except Exception:
            continue

    print(f"Recetas creadas: {created}")


if __name__ == "__main__":
    main()
