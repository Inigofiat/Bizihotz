# Bizihotz FastAPI Gateway

Gateway desarrollado en FastAPI que expone un punto de entrada único para los microservicios de Bizihotz. Sus funciones principales:

- Proxy transparente hacia cada microservicio (`/gestion`, `/nutricion`, etc.).
- Documentación agregada (Swagger) a partir de los OpenAPI individuales.
- Endpoint de salud (`/health`) para comprobar el estado de los servicios registrados.

## Requisitos

- Python 3.11+
- Dependencias listadas en `requirements.txt`

Instalación local:

```bash
python -m venv .venv
source .venv/bin/activate  # o .venv\Scripts\activate en Windows
pip install -r requirements.txt
```

## Configuración

El gateway se configura mediante variables de entorno (ver `.env.example`). Para cada microservicio define:

- `*_SERVICE_URL`: URL base a la que reenviar peticiones.
- `*_OPENAPI_URL`: documento OpenAPI que se agregará en `/docs`.

Ejemplo:

```
PORT=5000
GATEWAY_TIMEOUT=10
GESTION_SERVICE_URL=http://localhost:4001
GESTION_OPENAPI_URL=http://localhost:4001/docs/swagger.json
NUTRICION_SERVICE_URL=http://localhost:5002
NUTRICION_OPENAPI_URL=http://localhost:5002/openapi.json
```

## Ejecución

```bash
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```

Rutas relevantes:

- `GET /health`
- `GET /docs`
- `GET /openapi.json`
- `/gestion/*`, `/nutricion/*`, etc. → proxy hacia cada microservicio.
