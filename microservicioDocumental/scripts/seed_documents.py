from __future__ import annotations

"""
Script sencillo para insertar documentos de ejemplo en la base de datos.

Uso:
    python scripts/seed_documents.py

Respeta la cadena de conexión definida en .env (DATABASE_URL). Si la tabla no
existe, la crea antes de insertar.
"""

from pathlib import Path
import sys

# Permite ejecutar el script desde la carpeta del proyecto sin instalar el paquete
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import Base, engine, session_scope
from app.models.document import Documento


SEED_DOCUMENTS = [
    {
        "titulo": "Recomendaciones dietéticas",
        "descripcion": "Guía de la Agencia Española de Seguridad Alimentaria y Nutrición (AESAN).",
        "fuente": "AESAN",
        "tipo": "PDF",
        "etiquetas": ["salud", "nutricion", "recomendaciones"],
        "url_descarga": "https://www.aesan.gob.es/AECOSAN/docs/documentos/nutricion/RECOMENDACIONES_DIETETICAS.pdf",
        "external_id": "aesan-recomendaciones",
    },
    {
        "titulo": "Conceptos de alimentación",
        "descripcion": "Documento divulgativo de la SEGHNP sobre alimentación y nutrición pediátrica.",
        "fuente": "SEGHNP",
        "tipo": "PDF",
        "etiquetas": ["alimentacion", "divulgacion", "pediatria"],
        "url_descarga": "https://www.seghnp.org/sites/default/files/2017-06/conceptos-alimentacion.pdf",
        "external_id": "seghnp-conceptos",
    },
]


def main() -> None:
    # Garantiza que la tabla exista
    Base.metadata.create_all(bind=engine)

    with session_scope() as session:
        for payload in SEED_DOCUMENTS:
            exists = (
                session.query(Documento)
                .filter(
                    Documento.fuente == payload["fuente"],
                    Documento.external_id == payload["external_id"],
                )
                .first()
            )
            if exists:
                # Ya existe; saltar para evitar duplicado
                continue
            session.add(Documento(**payload))
        # commit implícito en session_scope


if __name__ == "__main__":
    main()
