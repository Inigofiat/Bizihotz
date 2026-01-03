from __future__ import annotations

from decimal import Decimal
from typing import Dict, List, Optional
from xml.etree import ElementTree as ET

import requests
from requests import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Alimento

BEDCA_ENDPOINT = "https://www.bedca.net/bdpub/procquery.php"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
BASE_HEADERS = {
    "User-Agent": UA,
    "Content-Type": "text/xml",
}

MACRO_MAP = {
    "ENERC": "calorias",
    "ENERC_KCAL": "calorias",
    "ENERC_KJ": "calorias",
    "FAT": "grasas",
    "LIPID": "grasas",
    "CHO": "carbohidratos",
    "CHOCDF": "carbohidratos",
    "PROT": "proteinas",
    "FIBTG": "fibra",
    "FIBT": "fibra",
}


def _do_request(xml: str, headers: Dict[str, str]) -> Response:
    return requests.post(
        BEDCA_ENDPOINT,
        data=xml.encode("utf-8"),
        headers=headers,
        timeout=30,
    )


def _post_xml(xml: str) -> ET.Element:
    # Algunos alimentos devuelven cuerpo vacío si los headers no son los esperados.
    attempts = [
        BASE_HEADERS,
        {"Content-Type": "text/xml", "User-Agent": UA, "Referer": "https://www.bedca.net/bdpub/"},
    ]
    last_response: Optional[Response] = None
    for headers in attempts:
        response = _do_request(xml, headers)
        last_response = response
        if response.content:
            break
    if last_response is None:
        raise ValueError("No se pudo contactar BEDCA")
    last_response.raise_for_status()
    if not last_response.content:
        raise ValueError("Respuesta vacía de BEDCA")
    return ET.fromstring(last_response.content)


def _to_decimal(value: Optional[str | float | int]) -> Decimal:
    if value is None:
        return Decimal("0")
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0")


def fetch_food_groups() -> List[Dict[str, str]]:
    xml = """<?xml version="1.0" encoding="utf-8"?>
<foodquery>
  <type level="3"/>
  <selection>
    <atribute name="fg_id"/>
    <atribute name="fg_ori_name"/>
    <atribute name="fg_eng_name"/>
  </selection>
  <order ordtype="ASC">
    <atribute3 name="fg_id"/>
  </order>
</foodquery>
"""
    root = _post_xml(xml)
    groups: List[Dict[str, str]] = []
    for item in root.findall("./food"):
        groups.append(
            {
                "id": item.findtext("fg_id"),
                "nombre": item.findtext("fg_ori_name") or item.findtext("fg_eng_name") or "",
            }
        )
    return groups


def fetch_foods_in_group(group_id: str) -> List[Dict[str, str]]:
    xml = f"""<?xml version="1.0" encoding="utf-8"?>
<foodquery>
  <type level="1"/>
  <selection>
    <atribute name="f_id"/>
    <atribute name="f_ori_name"/>
    <atribute name="f_eng_name"/>
    <atribute name="f_origen"/>
  </selection>
  <condition>
    <cond1><atribute1 name="foodgroup_id"/></cond1>
    <relation type="EQUAL"/>
    <cond3>{group_id}</cond3>
  </condition>
  <condition>
    <cond1><atribute1 name="f_origen"/></cond1>
    <relation type="EQUAL"/>
    <cond3>BEDCA</cond3>
  </condition>
  <order ordtype="ASC"><atribute3 name="f_ori_name"/></order>
</foodquery>
"""
    root = _post_xml(xml)
    foods: List[Dict[str, str]] = []
    for item in root.findall("./food"):
        foods.append(
            {
                "id": item.findtext("f_id"),
                "nombre": item.findtext("f_ori_name") or item.findtext("f_eng_name") or "",
            }
        )
    return foods


def fetch_food_detail(food_id: str) -> Optional[Dict[str, Decimal | str]]:
    xml = f"""<?xml version="1.0" encoding="utf-8"?>
<foodquery>
  <type level="2"/>
  <selection>
    <atribute name="f_id"/>
    <atribute name="f_ori_name"/>
    <atribute name="f_eng_name"/>
    <atribute name="edible_portion"/>
    <atribute name="f_origen"/>
    <atribute name="c_id"/>
    <atribute name="c_ori_name"/>
    <atribute name="c_eng_name"/>
    <atribute name="eur_name"/>
    <atribute name="componentgroup_id"/>
    <atribute name="best_location"/>
    <atribute name="v_unit"/>
  </selection>
  <condition>
    <cond1><atribute1 name="f_id"/></cond1>
    <relation type="EQUAL"/>
    <cond3>{food_id}</cond3>
  </condition>
  <condition>
    <cond1><atribute1 name="publico"/></cond1>
    <relation type="EQUAL"/>
    <cond3>1</cond3>
  </condition>
  <order ordtype="ASC"><atribute3 name="componentgroup_id"/></order>
</foodquery>
"""
    root = _post_xml(xml)
    food = root.find("./food")
    if food is None:
        return None

    nombre = food.findtext("f_ori_name") or food.findtext("f_eng_name") or ""
    macros: Dict[str, Decimal] = {
        "calorias": Decimal("0"),
        "proteinas": Decimal("0"),
        "grasas": Decimal("0"),
        "carbohidratos": Decimal("0"),
        "fibra": Decimal("0"),
    }

    for value in food.findall("./foodvalue"):
        eur_name = (value.findtext("eur_name") or "").strip().upper()
        best_location = _to_decimal(value.findtext("best_location"))
        unit = (value.findtext("v_unit") or "").strip()
        target = MACRO_MAP.get(eur_name)
        if not target:
            continue
        if target == "calorias" and unit.lower() == "kj":
            best_location = best_location * Decimal("0.24")
        macros[target] = best_location

    if macros["calorias"] == 0 and any([macros["proteinas"], macros["grasas"], macros["carbohidratos"]]):
        macros["calorias"] = (macros["proteinas"] * Decimal("4")) + (macros["carbohidratos"] * Decimal("4")) + (
            macros["grasas"] * Decimal("9")
        )

    return {
        "nombre": nombre,
        "calorias": float(macros["calorias"]),
        "proteinas": float(macros["proteinas"]),
        "grasas": float(macros["grasas"]),
        "carbohidratos": float(macros["carbohidratos"]),
        "fibra": float(macros["fibra"]),
        "unidad_base": "g",
        "descripcion": "Importado desde BEDCA",
    }


def sync_bedca_alimentos(session: Session) -> Dict[str, int]:
    creados = 0
    actualizados = 0
    grupos = fetch_food_groups()
    for grupo in grupos:
        foods = fetch_foods_in_group(grupo["id"])
        for food in foods:
            detail = fetch_food_detail(food["id"])
            if not detail or not detail.get("nombre"):
                continue
            existing = session.execute(
                select(Alimento).where(func.lower(Alimento.nombre) == detail["nombre"].lower())
            ).scalar_one_or_none()

            if existing:
                existing.calorias = detail["calorias"]
                existing.proteinas = detail["proteinas"]
                existing.grasas = detail["grasas"]
                existing.carbohidratos = detail["carbohidratos"]
                existing.fibra = detail["fibra"]
                existing.descripcion = detail["descripcion"]
                existing.unidad_base = detail["unidad_base"]
                actualizados += 1
            else:
                session.add(
                    Alimento(
                        nombre=detail["nombre"],
                        descripcion=detail["descripcion"],
                        calorias=detail["calorias"],
                        proteinas=detail["proteinas"],
                        grasas=detail["grasas"],
                        carbohidratos=detail["carbohidratos"],
                        fibra=detail["fibra"],
                        unidad_base=detail["unidad_base"],
                        micronutrientes={},
                    )
                )
                creados += 1
        session.commit()

    return {"creados": creados, "actualizados": actualizados}
