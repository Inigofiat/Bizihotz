from __future__ import annotations

import sys
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.database import session_scope  # noqa: E402
from app.models import (  # noqa: E402
    Alimento,
    AsignacionDieta,
    Dieta,
    DietaReceta,
    Receta,
    RecetaAlimento,
)


def decimal(value: float | int | str) -> Decimal:
    return Decimal(str(value))


def ensure_alimento(session, nombre: str, **data) -> Alimento:
    alimento = session.query(Alimento).filter_by(nombre=nombre).first()
    if alimento is None:
        alimento = Alimento(nombre=nombre, **data)
        session.add(alimento)
    else:
        for key, value in data.items():
            setattr(alimento, key, value)
    return alimento


def ensure_receta(
    session,
    nombre: str,
    descripcion: str | None,
    calorias_objetivo: Decimal | None,
    instrucciones: str | None,
    ingredientes: list[dict[str, object]],
) -> Receta:
    receta = session.query(Receta).filter_by(nombre=nombre).first()
    if receta is None:
        receta = Receta(nombre=nombre)
        session.add(receta)

    receta.descripcion = descripcion
    receta.calorias_objetivo = calorias_objetivo
    receta.instrucciones = instrucciones
    receta.ingredientes.clear()

    for ingrediente in ingredientes:
        receta.ingredientes.append(
            RecetaAlimento(
                alimento=ingrediente["alimento"],
                cantidad=decimal(ingrediente["cantidad"]),
                unidad=ingrediente.get("unidad"),
                observaciones=ingrediente.get("observaciones"),
            )
        )
    return receta


def ensure_dieta(
    session,
    *,
    nombre: str,
    es_plantilla: bool,
    version: int,
    usuario_id: int,
    paciente_id: str | None,
    objetivo: str | None,
    descripcion: str | None,
    notas: str | None,
    fecha_inicio: date,
    fecha_fin: date | None,
    estado: str,
    activa: bool,
    recetas: list[dict[str, object]],
    parent: Dieta | None = None,
) -> Dieta:
    dieta = (
        session.query(Dieta)
        .filter_by(nombre=nombre, es_plantilla=es_plantilla, paciente_id=paciente_id)
        .order_by(Dieta.version.desc())
        .first()
    )

    if dieta is None:
        dieta = Dieta(nombre=nombre, es_plantilla=es_plantilla)
        session.add(dieta)

    dieta.version = version
    dieta.usuario_id = usuario_id
    dieta.paciente_id = paciente_id
    dieta.objetivo = objetivo
    dieta.descripcion = descripcion
    dieta.notas = notas
    dieta.fecha_inicio = fecha_inicio
    dieta.fecha_fin = fecha_fin
    dieta.estado = estado
    dieta.activa = activa
    dieta.parent = parent
    dieta.calorias_objetivo = None

    dieta.recetas.clear()
    for item in recetas:
        dieta.recetas.append(
            DietaReceta(
                receta=item["receta"],
                dia_semana=item.get("dia"),
                momento=item.get("momento"),
                orden=item.get("orden"),
                porciones=item.get("porciones", 1),
            )
        )
    return dieta


def seed() -> None:
    alimentos_data = [
        {
            "nombre": "Avena integral",
            "descripcion": "Cereal integral rico en fibra soluble.",
            "calorias": decimal(389),
            "proteinas": decimal(16.9),
            "grasas": decimal(6.9),
            "carbohidratos": decimal(66.3),
            "fibra": decimal(10.6),
            "unidad_base": "g",
            "micronutrientes": {"hierro": 5.0, "magnesio": 177.0},
        },
        {
            "nombre": "Yogur natural descremado",
            "descripcion": "Fuente de calcio y probioticos.",
            "calorias": decimal(59),
            "proteinas": decimal(10),
            "grasas": decimal(0.4),
            "carbohidratos": decimal(3.6),
            "fibra": decimal(0),
            "unidad_base": "g",
            "micronutrientes": {"calcio": 183.0, "vitamina B2": 0.14},
        },
        {
            "nombre": "Manzana",
            "descripcion": "Fruta fresca con fibra y antioxidantes.",
            "calorias": decimal(52),
            "proteinas": decimal(0.3),
            "grasas": decimal(0.2),
            "carbohidratos": decimal(14),
            "fibra": decimal(2.4),
            "unidad_base": "g",
            "micronutrientes": {"vitamina C": 4.6, "potasio": 107.0},
        },
        {
            "nombre": "Quinoa cocida",
            "descripcion": "Pseudo cereal con proteina completa.",
            "calorias": decimal(120),
            "proteinas": decimal(4.4),
            "grasas": decimal(1.9),
            "carbohidratos": decimal(21.3),
            "fibra": decimal(2.8),
            "unidad_base": "g",
            "micronutrientes": {"manganeso": 0.6, "magnesio": 64.0},
        },
        {
            "nombre": "Pechuga de pollo asada",
            "descripcion": "Proteina magra sin piel.",
            "calorias": decimal(165),
            "proteinas": decimal(31),
            "grasas": decimal(3.6),
            "carbohidratos": decimal(0),
            "fibra": decimal(0),
            "unidad_base": "g",
            "micronutrientes": {"fosforo": 220.0, "selenio": 27.6},
        },
        {
            "nombre": "Ensalada verde base",
            "descripcion": "Mix de hojas verdes (espinaca, lechuga, rugula).",
            "calorias": decimal(25),
            "proteinas": decimal(2.1),
            "grasas": decimal(0.3),
            "carbohidratos": decimal(3.6),
            "fibra": decimal(2.2),
            "unidad_base": "g",
            "micronutrientes": {"vitamina A": 281.0, "folatos": 74.0},
        },
    ]

    recetas_data = [
        {
            "nombre": "Desayuno energetico",
            "descripcion": "Avena con yogur y manzana fresca.",
            "calorias_objetivo": decimal(420),
            "instrucciones": "Mezclar la avena con el yogur, reposar 10 minutos y agregar la manzana en cubos.",
            "ingredientes": [
                {"alimento": "Avena integral", "cantidad": 60, "unidad": "g"},
                {"alimento": "Yogur natural descremado", "cantidad": 200, "unidad": "g"},
                {"alimento": "Manzana", "cantidad": 120, "unidad": "g"},
            ],
        },
        {
            "nombre": "Bol de quinoa y pollo",
            "descripcion": "Quinoa con pollo asado y ensalada verde.",
            "calorias_objetivo": decimal(520),
            "instrucciones": "Disponer la quinoa tibia como base, sumar el pollo en tiras y completar con la ensalada.",
            "ingredientes": [
                {"alimento": "Quinoa cocida", "cantidad": 180, "unidad": "g"},
                {"alimento": "Pechuga de pollo asada", "cantidad": 130, "unidad": "g"},
                {"alimento": "Ensalada verde base", "cantidad": 90, "unidad": "g"},
            ],
        },
    ]

    with session_scope() as session:
        alimentos: dict[str, Alimento] = {}
        for item in alimentos_data:
            nombre = item.pop("nombre")
            alimento = ensure_alimento(session, nombre, **item)
            alimentos[nombre] = alimento

        recetas: dict[str, Receta] = {}
        for receta_data in recetas_data:
            nombre = receta_data["nombre"]
            ingredientes = [
                {
                    "alimento": alimentos[ing["alimento"]],
                    "cantidad": ing["cantidad"],
                    "unidad": ing.get("unidad"),
                    "observaciones": ing.get("observaciones"),
                }
                for ing in receta_data["ingredientes"]
            ]

            receta = ensure_receta(
                session,
                nombre=nombre,
                descripcion=receta_data.get("descripcion"),
                calorias_objetivo=receta_data.get("calorias_objetivo"),
                instrucciones=receta_data.get("instrucciones"),
                ingredientes=ingredientes,
            )
            recetas[nombre] = receta

        hoy = date.today()

        plantilla = ensure_dieta(
            session,
            nombre="Plan Equilibrado Semanal",
            es_plantilla=True,
            version=1,
            usuario_id=1,
            paciente_id=None,
            objetivo="Organizar desayunos y almuerzos base.",
            descripcion="Plantilla editable con opciones balanceadas de carbohidratos y proteinas.",
            notas="Partir de esta plantilla para ajustes individuales.",
            fecha_inicio=hoy,
            fecha_fin=None,
            estado="borrador",
            activa=True,
            parent=None,
            recetas=[
                {"receta": recetas["Desayuno energetico"], "dia": "Lunes", "momento": "Desayuno", "orden": 1},
                {"receta": recetas["Bol de quinoa y pollo"], "dia": "Lunes", "momento": "Almuerzo", "orden": 2},
            ],
        )

        personalizada = ensure_dieta(
            session,
            nombre="Plan Equilibrado Semanal - Paciente 101",
            es_plantilla=False,
            version=1,
            usuario_id=1,
            paciente_id=101,
            objetivo="Descenso de peso gradual con enfoque en saciedad.",
            descripcion="Derivada de la plantilla base, ajustada a las preferencias del paciente.",
            notas="Recordar reforzar hidratacion diaria.",
            fecha_inicio=hoy,
            fecha_fin=hoy + timedelta(days=14),
            estado="publicada",
            activa=True,
            parent=plantilla,
            recetas=[
                {"receta": recetas["Desayuno energetico"], "dia": "Lunes", "momento": "Desayuno", "orden": 1},
                {"receta": recetas["Bol de quinoa y pollo"], "dia": "Lunes", "momento": "Almuerzo", "orden": 2},
            ],
        )
        personalizada.publicada_en = datetime.utcnow()

        session.flush()

        for registro in session.query(AsignacionDieta).filter(
            AsignacionDieta.paciente_id == personalizada.paciente_id
        ):
            registro.es_actual = False

        asignacion = (
            session.query(AsignacionDieta)
            .filter_by(dieta_id=personalizada.id, paciente_id=personalizada.paciente_id)
            .first()
        )
        if asignacion is None:
            asignacion = AsignacionDieta(
                dieta=personalizada,
                paciente_id=personalizada.paciente_id,
                usuario_id=personalizada.usuario_id,
                version=personalizada.version,
                es_actual=True,
                comentario="Plan inicial generado desde script de pruebas.",
            )
            session.add(asignacion)
        else:
            asignacion.es_actual = True
            asignacion.version = personalizada.version
            asignacion.comentario = "Plan actualizado desde script de pruebas."

    print("Datos de demostracion cargados en la base de nutricion.")


if __name__ == "__main__":
    seed()
