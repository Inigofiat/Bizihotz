# Microservicio Documental (FastAPI)

Repositorio de documentos nutricionales. Expone endpoints REST para listar, filtrar y consultar documentos almacenados; no consume APIs externas.

## Requisitos

- Python 3.12+
- PostgreSQL 16+ (local o en contenedor)
- Dependencias de `requirements.txt`

## Configuración y base de datos

El archivo `.env.example` está preparado para el stack Bizihotz principal y apunta al Postgres compartido del `docker-compose` raíz:

```
DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/nutricion  # expuesto en localhost:5435
```

Si quieres ejecutar este servicio de forma aislada, cambia `DATABASE_URL` a tu instancia local (por ejemplo `postgresql+psycopg://postgres:postgres@localhost:5440/documental`) o usa el `docker-compose.yml` de esta carpeta que ya levanta su propio Postgres en `5440`.

## Puesta en marcha rápida (local)

```bash
cd microservicioDocumental
cp .env.example .env
python -m venv .venv
.\.venv\Scripts\activate          # Windows
# source .venv/bin/activate       # Linux/Mac
pip install -r requirements.txt
uvicorn app:app --reload --port 5100
```

## Usarlo dentro del stack Bizihotz

El `docker-compose.yml` raíz ya incluye este servicio como `documental`, apuntando al Postgres compartido. Suele bastar con:

```bash
docker compose up -d --build documental
```

Si prefieres una base separada, ajusta `DATABASE_URL` en la definición del servicio y crea la base la primera vez.

### Sembrar documentos de ejemplo

Hay un script de apoyo en `scripts/seed_documents.py` que inserta dos documentos públicos. Ejecuta:

```bash
cd microservicioDocumental
python scripts/seed_documents.py
```

Respeta `DATABASE_URL` del `.env` y crea la tabla si no existe.

## Docker Compose (servicio aislado)

```bash
cd microservicioDocumental
docker compose up -d --build
```

Esto levanta PostgreSQL en `localhost:5440` y el servicio en `http://localhost:5100`.

## Endpoints relevantes

- `GET /health`: estado del servicio.
- `GET /api/documentos`: listado con filtros `q`, `fuente`, `tipo`, `etiqueta`, paginación `skip/limit`.
- `GET /api/documentos/{id}`: detalle.
- `GET /api/documentos/{id}/contenido`: proxy seguro para visualizar/descargar el binario del documento.

Swagger disponible en `/docs`.

## Modelo de datos

Tabla `documentos` con:

- `titulo`, `descripcion`, `etiquetas` (JSON array), `tipo`, `fuente`, `external_id`, `url_descarga`, `metadata` (json), `fecha_subida`, `last_synced_at`, `estado`, `idioma`.
- Restricción única por `fuente + external_id` para evitar duplicados.

## Búsqueda

- En PostgreSQL, `q` usa `plainto_tsquery` con diccionario `spanish` sobre `titulo + descripcion` y ordena por relevancia (`ts_rank`). En otras bases, hace `ILIKE`.
- Recomendado añadir un índice FTS:

```sql
CREATE INDEX IF NOT EXISTS idx_documento_fts
ON documentos
USING GIN (to_tsvector('spanish', coalesce(titulo,'') || ' ' || coalesce(descripcion,'')));
```

## Notas

- El servicio no guarda binarios; almacena la URL de descarga o la ruta externa.
- Índices básicos por `fuente` y `tipo`. Para búsquedas más ricas, puedes añadir FTS con `pg_trgm`.
