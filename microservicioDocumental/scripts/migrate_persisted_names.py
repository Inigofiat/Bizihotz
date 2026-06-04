from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import inspect, text

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.database import engine


TABLE_RENAMES = [
    ("documentos", "Documento"),
]

COLUMN_RENAMES = {
    "Documento": [
        ("external_id", "refer"),
        ("url_descarga", "url"),
        ("ruta_archivo", "rutaArchivo"),
        ("fecha_subida", "fechaSubida"),
        ("last_synced_at", "ultimaAct"),
    ],
}


def quote(name: str) -> str:
    return engine.dialect.identifier_preparer.quote(name)


def has_table(connection, table_name: str) -> bool:
    return inspect(connection).has_table(table_name)


def column_names(connection, table_name: str) -> set[str]:
    return {column["name"] for column in inspect(connection).get_columns(table_name)}


def rename_table_if_safe(connection, old: str, new: str) -> None:
    if not has_table(connection, old):
        print(f"[skip] Tabla origen no existe: {old}")
        return
    if has_table(connection, new):
        print(f"[skip] Ya existe {new}; no se renombra {old} para no sobrescribir datos.")
        return

    connection.execute(text(f"ALTER TABLE {quote(old)} RENAME TO {quote(new)}"))
    print(f"[ok] Tabla {old} -> {new}")


def rename_column_if_safe(connection, table_name: str, old: str, new: str) -> None:
    if not has_table(connection, table_name):
        print(f"[skip] Tabla no existe para columnas: {table_name}")
        return

    columns = column_names(connection, table_name)
    if old not in columns:
        print(f"[skip] {table_name}.{old} no existe")
        return
    if new in columns:
        print(f"[skip] {table_name}.{new} ya existe; no se renombra {old}.")
        return

    connection.execute(
        text(f"ALTER TABLE {quote(table_name)} RENAME COLUMN {quote(old)} TO {quote(new)}")
    )
    print(f"[ok] Columna {table_name}.{old} -> {new}")


def main() -> None:
    with engine.begin() as connection:
        for old, new in TABLE_RENAMES:
            rename_table_if_safe(connection, old, new)

        for table_name, renames in COLUMN_RENAMES.items():
            for old, new in renames:
                rename_column_if_safe(connection, table_name, old, new)


if __name__ == "__main__":
    main()
