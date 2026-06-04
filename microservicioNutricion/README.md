# Bizihotz - microservicio de nutricion (M2)

API REST creada con FastAPI y PostgreSQL que gestiona alimentos, recetas, planes y asignaciones dentro del ecosistema Bizihotz.

## Endpoints principales

- `GET /health`: estado del servicio y conexion a la base de datos.
- CRUD para `alimentos`, `recetas` y `dietas`.
- `POST /api/dietas/{id}/asignaciones`: publica una dieta para un paciente.
- `POST /api/dietas/{id}/versionar`: genera una nueva version de dieta.
- `GET /api/dietas/{id}/exportar?formato=pdf|csv`: exporta el plan nutricional.
- `POST /api/dietas/{id}/notificar`: envia la dieta a traves del servicio externo configurado.
- Scripts utilitarios (`scripts/seed_demo.py`, `scripts/migrate_patient_ids_to_text.py`) para poblar datos o adaptar el esquema.

## Variables y configuracion

Copia `.env.example` a `.env` y ajusta:

- `DATABASE_URL`: URL SQLAlchemy (por defecto `postgresql+psycopg://postgres:postgres@postgres:5432/nutricion` al usar Docker).
- `GESTION_SERVICE_URL`: base URL del microservicio de gestion para validar `paciente_id` (ej. `http://gestion:4001/api`).
- `VALIDATE_PACIENTE_WITH_GESTION`: activa/desactiva la validacion cruzada (`true` por defecto).
- `GESTION_SERVICE_TIMEOUT`: timeout (segundos) para validaciones en gestion.
- `GESTION_SERVICE_BEARER_TOKEN`: token opcional para validacion server-to-server cuando no se reenvia `Authorization`.
- `NOTIFICATIONS_SERVICE_URL` y `NOTIFICATIONS_SERVICE_API_KEY`: webhook opcional para avisar al paciente.
- `CORS_ALLOWED_ORIGINS`: lista separada por comas con origenes permitidos (por defecto `*`).
- `EXPORT_FOOTER_NOTE`: texto que aparece en los archivos exportados.

## Ejecucion con Docker Compose

1. Posicionate en `microservicioNutricion/`.
2. Prepara variables con `cp .env.example .env`.
3. Levanta el stack:
   ```bash
   docker compose up -d --build
   ```
   Esto crea dos servicios:
   - `postgres` expuesto en `localhost:5434`.
   - `microservicio-nutricion` ejecutando `uvicorn app:app --reload` en `http://localhost:5002`.
4. (Opcional) Pobla datos de ejemplo:
   ```bash
   docker compose exec microservicio-nutricion python scripts/seed_demo.py
   ```
5. Revisa logs con `docker compose logs -f microservicio-nutricion` y detiene todo con `docker compose down`.

## Ejecucion local sin Docker

1. Activa un entorno virtual y dependencias:
   ```bash
   python -m venv .venv
   source .venv/bin/activate    # Windows: .venv\\Scripts\\activate
   pip install -r requirements.txt
   ```
2. Define `DATABASE_URL` apuntando a tu Postgres (`postgresql+psycopg://postgres:postgres@localhost:5432/nutricion`) o usa SQLite (`sqlite:///nutricion.db`) para pruebas rapidas.
3. Inicia el servidor:
   ```bash
   uvicorn app:app --reload --port 5002
   ```
4. Ejecuta seeds o migraciones cuando lo necesites:
   ```bash
   python scripts/seed_demo.py
   python scripts/migrate_patient_ids_to_text.py
   ```

## Migracion de identificadores

Si ya tenias tablas y ahora integras el microservicio de gestion, ejecuta `scripts/migrate_patient_ids_to_text.py` (via Docker o local) para convertir `paciente_id` a texto y aceptar ObjectId externos.

## Acceso a la base de datos

- Con Docker: `localhost:5434`, usuario `postgres`, password `postgres`, base `nutricion`.
- Local/manual: usa la URL configurada en tu `.env`.

## Caracteristicas destacadas

- Calculo de calorias, macros y micronutrientes por receta o dieta.
- Versionado de dietas y seguimiento de asignaciones por paciente.
- Validacion opcional de `paciente_id` contra el microservicio de gestion antes de crear/asignar dietas.
- Exportacion CSV/PDF lista para compartir.
- Integracion opcional con un webhook de notificaciones.
- Seeds (`scripts/seed_demo.py`) para contar con catalogos y ejemplos al iniciar.
