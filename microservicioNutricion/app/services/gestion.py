from __future__ import annotations

from typing import Any
from urllib.parse import quote

import requests
from fastapi import HTTPException, status

from ..config import get_settings


def _build_headers(
    incoming_authorization: str | None, service_bearer_token: str | None
) -> dict[str, str]:
    headers = {"Accept": "application/json"}
    if incoming_authorization:
        headers["Authorization"] = incoming_authorization
        return headers

    token = (service_bearer_token or "").strip()
    if token:
        if token.lower().startswith("bearer "):
            headers["Authorization"] = token
        else:
            headers["Authorization"] = f"Bearer {token}"
    return headers


def _extract_upstream_message(response: requests.Response) -> str:
    try:
        payload: Any = response.json()
    except ValueError:
        return (response.text or "").strip()

    if isinstance(payload, dict):
        message = payload.get("mensaje") or payload.get("detail") or payload.get("message")
        return str(message).strip() if message else ""
    return ""


def validar_paciente_en_gestion(
    paciente_id: str, incoming_authorization: str | None = None
) -> None:
    settings = get_settings()
    if not settings.validate_paciente_with_gestion:
        return

    paciente_id_normalizado = (paciente_id or "").strip()
    if not paciente_id_normalizado:
        return

    if not settings.gestion_service_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "La validacion de pacientes esta habilitada, pero falta configurar "
                "GESTION_SERVICE_URL."
            ),
        )

    paciente_id_escaped = quote(paciente_id_normalizado, safe="")
    url = f"{settings.gestion_service_url.rstrip('/')}/pacientes/{paciente_id_escaped}"
    headers = _build_headers(
        incoming_authorization=incoming_authorization,
        service_bearer_token=settings.gestion_service_bearer_token,
    )

    try:
        response = requests.get(url, headers=headers, timeout=settings.gestion_service_timeout)
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No fue posible validar el paciente en el microservicio de gestion.",
        ) from exc

    if response.status_code == status.HTTP_200_OK:
        return

    upstream_message = _extract_upstream_message(response)
    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El paciente_id '{paciente_id_normalizado}' no existe en gestion.",
        )
    if response.status_code == status.HTTP_400_BAD_REQUEST:
        detalle = upstream_message or "Identificador de paciente invalido."
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detalle)
    if response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "No autorizado para validar pacientes en gestion. "
                "Revisa el token Bearer o GESTION_SERVICE_BEARER_TOKEN."
            ),
        )

    detalle = upstream_message or f"Estado inesperado de gestion: {response.status_code}"
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"Fallo al validar paciente en gestion. {detalle}",
    )
