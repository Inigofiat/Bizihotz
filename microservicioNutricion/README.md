### Microservicio de Nutricion (M2)

API REST construida con FastAPI y PostgreSQL para gestionar alimentos, recetas y planes de dieta dentro del ecosistema Bizihotz.

#### Endpoints principales

- `GET /health` - estado del servicio y comprobacion de la base de datos.
- `GET/POST/PUT/DELETE /api/alimentos` - CRUD de alimentos (valores por 100 g).
- `GET /api/alimentos/externo/buscar?q=` - consulta a la API externa (Edamam por defecto).
- `GET/POST/PUT/DELETE /api/recetas` - gestion de recetas con ingredientes.
- `GET/POST/PUT/DELETE /api/dietas` - gestion de dietas (plantillas y personalizadas).
- `POST /api/dietas/{id}/asignaciones` - publica una dieta para un paciente a partir de una plantilla.
- `POST /api/dietas/{id}/versionar` - genera una nueva version para mantener el historial por paciente.
- `GET /api/dietas/{id}/exportar?formato=pdf|csv` - exportacion del plan nutricional.
- `POST /api/dietas/{id}/notificar` - envio del plan al paciente via servicio externo.
- `scripts/seed_demo.py` - script utilitario que genera alimentos, recetas, una plantilla y una dieta personalizada de ejemplo.

## Formas de ejecución

El microservicio puede levantarse dentro del stack Docker (recomendado) o de manera directa en tu entorno local. Ambos caminos comparten la misma configuración, controlada por las variables del archivo `.env`.

### Opción A · Docker Compose

1. **Configura variables:** copia `.env.example` a `.env`. Con el stack dockerizado no modifiques `DATABASE_URL` (ya apunta al servicio interno `postgres`).
2. **Levanta los contenedores:**
   ```bash
   docker compose up -d --build
   ```
   Esto crea:
   - `postgres` accesible desde el host en `localhost:5434`
   - `microservicio-nutricion` corriendo `uvicorn app:app` en `http://localhost:5002`
3. **Carga datos de ejemplo (opcional):**
   ```bash
   docker compose exec microservicio-nutricion python scripts/seed_demo.py
   ```
4. **Verifica:** `GET http://localhost:5002/api/health` debería devolver `{"status": "ok"}`.
5. **Logs / apagado:**
   ```bash
   docker compose logs -f microservicio-nutricion
   docker compose down
   ```

### Opción B · Ejecución directa (sin Docker)

1. **Instala dependencias:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Define `DATABASE_URL` en un `.env`:**
   - PostgreSQL local: `postgresql+psycopg://postgres:postgres@localhost:5432/nutricion`
   - SQLite (modo rápido): `sqlite:///nutricion.db`
3. **Levanta el servidor:**
   ```bash
   uvicorn app:app --reload --port 5002
   ```
   Al iniciar se crearán las tablas si no existen.
4. **Semilla opcional:**
   ```bash
   python scripts/seed_demo.py
   ```

> Nota: si cambias el esquema y necesitas limpiar la base PostgreSQL, elimina y recrea la BD con `DROP DATABASE nutricion` y `CREATE DATABASE nutricion`, o usa tu cliente favorito (pgAdmin, psql, etc.).

### Acceso a la base de datos

- Con Docker: usa `localhost:5434`, usuario `postgres`, clave `postgres`, base `nutricion`.
- Sin Docker (según tu configuración): usa la URL que hayas definido en `DATABASE_URL`.

#### Caracteristicas

- Calculos de calorias, macros y micronutrientes a partir del catalogo de alimentos.
- Integracion opcional con proveedores externos de datos nutricionales mediante las variables `EXTERNAL_NUTRITION_*`.
- Versionado de dietas por paciente, historial de asignaciones y exportacion CSV/PDF lista para compartir.
- Webhook de notificaciones configurable (`NOTIFICATIONS_SERVICE_URL`) para comunicar cambios al paciente.
- Script de datos de ejemplo (`python scripts/seed_demo.py`) para contar con un escenario base tras iniciar la base de datos.
- Arquitectura preparada para convivir con un API Gateway encargado de autenticacion y autorizacion.
