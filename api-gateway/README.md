# Bizihotz FastAPI Gateway

Punto de entrada comun para los microservicios Bizihotz. Reenvia solicitudes hacia `gestion`, `nutricion`, `comunicacion`, `documentos` y futuros servicios, agrega los documentos OpenAPI y expone endpoints de salud.

## Funciones

- Proxy transparente (`/gestion/*`, `/nutricion/*`, `/comunicacion/*`, `/documentos/*`, `/chatbot/*`, ...).
- Documentacion unificada en `/docs` y `/openapi.json`.
- Endpoint `/health` para verificar disponibilidad de los servicios registrados.
- Carga dinamica de OpenAPI remotos para combinarlos en el esquema del gateway.

## Requisitos

- Python 3.11+
- Dependencias de `requirements.txt`
- Variables definidas en `.env` o variables de entorno del sistema.

## Configuracion minima

```env
PORT=5000
GATEWAY_TIMEOUT=10
GESTION_SERVICE_URL=http://localhost:4001
GESTION_OPENAPI_URL=http://localhost:4001/docs/swagger.json
NUTRICION_SERVICE_URL=http://localhost:5002
NUTRICION_OPENAPI_URL=http://localhost:5002/openapi.json
COMUNICACION_SERVICE_URL=http://localhost:4100
COMUNICACION_OPENAPI_URL=http://localhost:4100/docs/swagger.json
DOCUMENTOS_SERVICE_URL=http://localhost:5100
DOCUMENTOS_OPENAPI_URL=http://localhost:5100/openapi.json
CHATBOT_SERVICE_URL=http://localhost:4701
CHATBOT_OPENAPI_URL=http://localhost:4701/docs/swagger.json
```

Agrega tantas parejas `*_SERVICE_URL` / `*_OPENAPI_URL` como microservicios quieras publicar.

## Ejecucion local

```bash
cd api-gateway
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```

El gateway intentara descargar los documentos OpenAPI configurados. Asegurate de que los microservicios esten arriba (o usa el stack de Docker compose en la raiz) para evitar errores al iniciar.

## Ejecucion dentro del stack Docker

El archivo `docker-compose.yml` de la raiz construye esta carpeta y levanta el gateway junto con los microservicios. Puedes limitarte a ese flujo si no necesitas hacer debugging local.

```bash
docker compose up api-gateway --build
```

## Rutas relevantes

- `GET /health`
- `GET /docs`
- `GET /openapi.json`
- `/gestion/*`, `/nutricion/*`, `/comunicacion/*`, `/documentos/*`, `/chatbot/*`, ... -> proxys hacia cada servicio configurado.
