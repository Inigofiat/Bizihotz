from __future__ import annotations

import base64
from typing import Any, Dict

import requests

from ..config import get_settings
from ..models import Dieta
from .export import generar_csv_dieta, generar_pdf_dieta


def enviar_notificacion_dieta(
    dieta: Dieta,
    canal: str,
    asunto: str | None,
    mensaje: str | None,
    adjuntar_pdf: bool,
    adjuntar_csv: bool,
    incluir_profesional: bool,
) -> Dict[str, Any]:
    settings = get_settings()
    if not settings.notifications_service_url:
        raise ValueError("No hay servicio de notificaciones configurado.")

    payload: Dict[str, Any] = {
        "canal": canal,
        "pacienteId": dieta.pacienteId,
        "asunto": asunto or f"Plan nutricional {dieta.nombre}",
        "mensaje": mensaje or "Se ha actualizado tu plan nutricional.",
        "datosDieta": {
            "dietaId": dieta.id,
            "version": dieta.version,
            "usuarioId": dieta.usuarioId,
        },
        "enviarCopiaProfesional": incluir_profesional,
    }

    adjuntos = []
    if adjuntar_pdf:
        pdf_bytes, pdf_nombre = generar_pdf_dieta(dieta, settings.export_footer_note)
        adjuntos.append(
            {
                "nombre": pdf_nombre,
                "contentType": "application/pdf",
                "contenido": base64.b64encode(pdf_bytes).decode("ascii"),
            }
        )
    if adjuntar_csv:
        csv_bytes, csv_nombre = generar_csv_dieta(dieta)
        adjuntos.append(
            {
                "nombre": csv_nombre,
                "contentType": "text/csv",
                "contenido": base64.b64encode(csv_bytes).decode("ascii"),
            }
        )

    if adjuntos:
        payload["adjuntos"] = adjuntos

    headers = {"Content-Type": "application/json"}
    if settings.notifications_service_api_key:
        headers["X-API-Key"] = settings.notifications_service_api_key

    try:
        response = requests.post(
            settings.notifications_service_url,
            json=payload,
            headers=headers,
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise ValueError(f"No fue posible notificar al paciente: {exc}") from exc

    try:
        return response.json()
    except ValueError:
        return {"status": "sin_respuesta_json", "codigo": response.status_code}
