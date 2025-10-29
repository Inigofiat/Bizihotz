from __future__ import annotations

from collections import defaultdict
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


def _round_dict(values: Dict[str, Decimal]) -> Dict[str, float]:
    return {clave: float(round(valor, 2)) for clave, valor in values.items()}


def calcular_totales_receta(receta: Receta) -> Dict[str, Dict[str, float]]:
    """
    Calcula los nutrientes totales de una receta sumando los aportes de sus alimentos.

    Se asume que los valores nutricionales de cada alimento están expresados por 100 unidades
    de su `unidad_base`. Por defecto trabajamos en gramos.
    """
    macros = {clave: Decimal("0") for clave in NUTRIENT_KEYS}
    micros: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))

    for item in receta.ingredientes:
        alimento = item.alimento
        if alimento is None:
            continue

        factor = _to_decimal(item.cantidad) / Decimal("100")

        for clave in NUTRIENT_KEYS:
            valor_alimento = getattr(alimento, clave, None)
            macros[clave] += factor * _to_decimal(valor_alimento)

        if alimento.micronutrientes:
            for nombre, valor in alimento.micronutrientes.items():
                micros[nombre] += factor * _to_decimal(valor)

    return {"macros": _round_dict(macros), "micros": _round_dict(micros)}


def calcular_totales_dieta(recetas) -> Dict[str, Dict[str, float]]:
    macros_acumulados = {clave: Decimal("0") for clave in NUTRIENT_KEYS}
    micros_acumulados: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))

    for dieta_receta in recetas:
        receta = dieta_receta.receta
        if receta is None:
            continue

        porciones = _to_decimal(dieta_receta.porciones or 1)
        receta_totales = calcular_totales_receta(receta)
        for clave in NUTRIENT_KEYS:
            macros_acumulados[clave] += porciones * _to_decimal(
                receta_totales["macros"].get(clave)
            )
        for nombre, valor in receta_totales["micros"].items():
            micros_acumulados[nombre] += porciones * _to_decimal(valor)

    return {
        "macros": _round_dict(macros_acumulados),
        "micros": _round_dict(micros_acumulados),
    }
