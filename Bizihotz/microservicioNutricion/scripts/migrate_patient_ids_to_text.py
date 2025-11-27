"""Script de migración para convertir las columnas paciente_id a texto.

Ejecuta:
    python scripts/migrate_patient_ids_to_text.py

Debe correrse una sola vez después de actualizar el modelo para aceptar
identificadores alfanuméricos (por ejemplo, ObjectId de MongoDB).
"""
from __future__ import annotations

from sqlalchemy import text

from app.database import engine


ALTER_COMMANDS = [
    "ALTER TABLE dietas ALTER COLUMN paciente_id TYPE VARCHAR(128);",
    "ALTER TABLE dietas_asignaciones ALTER COLUMN paciente_id TYPE VARCHAR(128);",
]


def migrate() -> None:
    dialect = engine.dialect.name
    if dialect not in {"postgresql", "mysql"}:
        print(
            f"El motor '{dialect}' no soporta ALTER TABLE automático en este script.\n"
            "Por favor, convierte manualmente las columnas paciente_id a VARCHAR(128)."
        )
        return

    with engine.begin() as connection:
        for command in ALTER_COMMANDS:
            connection.execute(text(command))

    print("Columnas paciente_id convertidas a VARCHAR(128).")


if __name__ == "__main__":
    migrate()
