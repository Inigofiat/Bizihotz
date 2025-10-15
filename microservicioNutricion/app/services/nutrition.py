from __future__ import annotations

from decimal import Decimal
from typing import Dict

from ..models.receta import Receta

NUTRIENT_KEYS = ("calorias", "proteinas", "grasas", "carbohidratos", "fibra")


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def calcular_totales_receta(receta: Receta) -> Dict[str, float]:
    """
    Calcula los macronutrientes totales de una receta sumando los nutrientes de sus alimentos.

    Se asume que los valores nutricionales de cada alimento están expresados por 100 unidades
    de su `unidad_base`. Por defecto trabajamos en gramos.
    """
    totales = {clave: Decimal("0") for clave in NUTRIENT_KEYS}

    for item in receta.ingredientes:
        alimento = item.alimento
        if alimento is None:
            continue

        factor = _to_decimal(item.cantidad) / Decimal("100")

        for clave in NUTRIENT_KEYS:
            valor_alimento = getattr(alimento, clave, None)
            totales[clave] += factor * _to_decimal(valor_alimento)

    return {clave: float(round(valor, 2)) for clave, valor in totales.items()}


def calcular_totales_dieta(recetas) -> Dict[str, float]:
    totales = {clave: 0.0 for clave in NUTRIENT_KEYS}

    for dieta_receta in recetas:
        receta = dieta_receta.receta
        if receta is None:
            continue

        porciones = dieta_receta.porciones or 1
        receta_totales = calcular_totales_receta(receta)
        for clave in NUTRIENT_KEYS:
            totales[clave] += receta_totales.get(clave, 0.0) * porciones

    return {clave: round(valor, 2) for clave, valor in totales.items()}
