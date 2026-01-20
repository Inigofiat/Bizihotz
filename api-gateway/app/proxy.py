from __future__ import annotations

from urllib.parse import urljoin

import httpx
from fastapi import HTTPException, Request
from starlette.responses import Response, StreamingResponse

from .config import ServiceConfig

PROXY_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]
_EXCLUDED_RESPONSE_HEADERS = {
    "transfer-encoding",
    "content-length",
    "connection",
    "keep-alive",
}


def _build_target_url(service: ServiceConfig, path: str, query: str) -> str:
    base = f"{service.target.rstrip('/')}/"
    normalized_path = path.lstrip("/")
    url = urljoin(base, normalized_path)
    if query:
        return f"{url}?{query}"
    return url


def _filter_response_headers(headers: httpx.Headers) -> dict[str, str]:
    filtered: dict[str, str] = {}
    for key, value in headers.items():
        if key.lower() in _EXCLUDED_RESPONSE_HEADERS:
            continue
        filtered[key] = value
    return filtered


async def proxy_request(request: Request, service: ServiceConfig, path: str = "") -> StreamingResponse:
    client: httpx.AsyncClient = request.app.state.http_client
    target_url = _build_target_url(service, path, request.url.query)

    headers = dict(request.headers)
    headers["x-forwarded-by"] = "bizihotz-fastapi-gateway"
    headers["host"] = httpx.URL(service.target).netloc

    body = await request.body()
    content = body if body else None

    stream_ctx = client.stream(
        request.method,
        target_url,
        content=content,
        headers=headers,
        cookies=request.cookies,
    )
    try:
        upstream = await stream_ctx.__aenter__()
    except httpx.HTTPError as exc:
        await stream_ctx.__aexit__(None, None, None)
        raise HTTPException(
            status_code=502,
            detail=f"Error al contactar con el servicio {service.name}: {exc}",
        ) from exc

    filtered_headers = _filter_response_headers(upstream.headers)

    async def iterator():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await stream_ctx.__aexit__(None, None, None)

    return StreamingResponse(
        iterator(),
        status_code=upstream.status_code,
        headers=filtered_headers,
        media_type=upstream.headers.get("content-type"),
    )
