"""Script de migracion para convertir las columnas pacienteId a texto.

Ejecuta:
    python scripts/migrate_patient_ids_to_text.py

Debe correrse una sola vez despues de actualizar el modelo para aceptar
identificadores alfanumericos, por ejemplo ObjectId de MongoDB.
"""
from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import text

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.database import engine


ALTER_COMMANDS = [
    'ALTER TABLE "Dieta" ALTER COLUMN "pacienteId" TYPE VARCHAR(128);',
    'ALTER TABLE "DietaAsignacion" ALTER COLUMN "pacienteId" TYPE VARCHAR(128);',
]


def migrate() -> None:
    dialect = engine.dialect.name
    if dialect != "postgresql":
        print(
            f"El motor '{dialect}' no soporta ALTER TABLE automatico en este script.\n"
            "Por favor, convierte manualmente las columnas pacienteId a VARCHAR(128)."
        )
        return

    with engine.begin() as connection:
        for command in ALTER_COMMANDS:
            connection.execute(text(command))

    print("Columnas pacienteId convertidas a VARCHAR(128).")


if __name__ == "__main__":
    migrate()
