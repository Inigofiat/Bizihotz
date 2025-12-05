# Microservicio Documental (FastAPI)

Repositorio de documentos nutricionales. Expone endpoints REST para listar y buscar documentos almacenados; no consume APIs externas.

## Requisitos

- Python 3.12+
- PostgreSQL (local o en contenedor)
- Dependencias de `requirements.txt`

## Puesta en marcha rapida

```bash
cd microservicioDocumental
cp .env.example .env
python -m venv .venv
.\.venv\Scripts\activate          # Windows
# source .venv/bin/activate       # Linux/Mac
pip install -r requirements.txt
uvicorn app:app --reload --port 5100
```

Por defecto se conecta a `postgresql://postgres:postgres@localhost:5440/documental`. Ajusta `DATABASE_URL` en `.env` si usas otro host/puerto/base.

### Usarlo dentro del stack Bizihotz

En el `docker-compose.yml` raiz ya se incluye este servicio y se conecta al Postgres compartido (`postgres` servicio) usando la misma base `nutricion`. Si prefieres una base separada, cambia `DATABASE_URL` en la definicion del servicio y crea la base la primera vez (puedes hacerlo con un script en `docker-entrypoint-initdb.d` o manualmente).

### Docker Compose (servicio aislado)

```bash
cd microservicioDocumental
docker compose up -d --build
```

Esto levanta PostgreSQL en el puerto `5440` y el servicio en `5100`.

## Endpoints relevantes

- `GET /health` — estado del servicio.
- `GET /api/documentos` — listado con filtros `q`, `fuente`, `tipo`, `etiqueta`, paginacion `skip/limit`.
- `GET /api/documentos/{id}` — detalle.
- No hay endpoints de sincronizacion con fuentes externas (deshabilitado).

Swagger disponible en `/docs`.

## Modelo de datos

Tabla `documentos` con:

- `titulo`, `descripcion`, `etiquetas` (JSON array), `tipo`, `fuente`, `external_id`, `url_descarga`, `metadata` (json), `fecha_subida`, `last_synced_at`, `estado`, `idioma`.
- Constraint unico por `fuente + external_id` para evitar duplicados.

## Busqueda

- Si la base es PostgreSQL, `q` usa `plainto_tsquery` con diccionario `spanish` para buscar en `titulo + descripcion` y ordena por relevancia (`ts_rank`). En otras bases de datos, hace `ILIKE`.
- Recomendado anadir un indice FTS para acelerar:

```sql
CREATE INDEX IF NOT EXISTS idx_documento_fts
ON documentos
USING GIN (to_tsvector('spanish', coalesce(titulo,'') || ' ' || coalesce(descripcion,'')));
```

## Notas

- El servicio no guarda binarios; almacena la URL de descarga o la ruta si decides persistirlos externamente.
- Indices basicos por `fuente` y `tipo`. Para busquedas mas ricas, puede anadirse FTS con `pg_trgm` y `to_tsvector`.
