### Microservicio de Nutrici髇 (M2)

API REST construida con FastAPI y PostgreSQL para gesti髇ar alimentos, recetas y planes de dieta dentro del ecosistema Bizihotz.

#### Endpoints principales

- `GET /health` - estado del servicio y comprobaci髇 de la base de datos.
- `GET/POST/PUT/DELETE /api/alimentos` - CRUD de alimentos (valores por 100 g).
- `GET /api/alimentos/externo/buscar?q=` - consulta a la API externa (Edamam por defecto).
- `GET/POST/PUT/DELETE /api/recetas` - gesti髇 de recetas con ingredientes.
- `GET/POST/PUT/DELETE /api/dietas` - gesti髇 de dietas (plantillas y personalizadas).
- `POST /api/dietas/{id}/asignaciones` - publica una dieta para un paciente a partir de una plantilla.
- `POST /api/dietas/{id}/versi髇ar` - genera una nueva versi髇 para mantener el historial por paciente.
- `GET /api/dietas/{id}/exportar?formato=pdf|csv` - exportaci髇 del plan nutrici髇al.
- `POST /api/dietas/{id}/notificar` - env韔 del plan al paciente via servicio externo.
- `scripts/seed_demo.py` - script utilitario que genera alimentos, recetas, una plantilla y una dieta personalizada de ejemplo.

## Formas de ejecuci贸n

El microservicio puede levantarse dentro del stack Docker (recomendado) o de manera directa en tu entorno local. Ambos caminos comparten la misma configuraci贸n, controlada por las variables del archivo `.env`.

### Opci贸n A 路 Docker Compose

1. **Configura variables:** copia `.env.example` a `.env`. Con el stack dockerizado no modifiques `DATABASE_URL` (ya apunta al servicio interno `postgres`).
2. **Levanta los contenedores:**
   ```bash
   docker compose up -d --build
   ```
   Esto crea:
   - `postgres` accesible desde el host en `localhost:5434`
   - `microservicio-nutrici髇` corriendo `uvicorn app:app` en `http://localhost:5002`
3. **Carga datos de ejemplo (opcional):**
   ```bash
   docker compose exec microservicio-nutrici髇 python scripts/seed_demo.py
   ```
4. **Verifica:** `GET http://localhost:5002/api/health` deber铆a devolver `{"status": "ok"}`.
5. **Logs / apagado:**
   ```bash
   docker compose logs -f microservicio-nutrici髇
   docker compose down
   ```

### Opci贸n B 路 Ejecuci贸n directa (sin Docker)

1. **Instala dependencias:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Define `DATABASE_URL` en un `.env`:**
   - PostgreSQL local: `postgresql+psycopg://postgres:postgres@localhost:5432/nutrici髇`
   - SQLite (modo r谩pido): `sqlite:///nutrici髇.db`
3. **Levanta el servidor:**
   ```bash
   uvicorn app:app --reload --port 5002
   ```
   Al iniciar se crear谩n las tablas si no existen.
4. **Semilla opcional:**
   ```bash
   python scripts/seed_demo.py
   ```

### Migraci贸n a identificadores alfanum茅ricos

A partir de la integraci贸n con el microservicio de gesti贸n, `paciente_id` ahora almacena el identificador externo (ObjectId). Si ya ten铆as tablas creadas debes actualizar el tipo de columna a texto:

```bash
docker compose exec microservicio-nutrici髇 python scripts/migrate_patient_ids_to_text.py
# o en local
python scripts/migrate_patient_ids_to_text.py
```

El script aplica `ALTER TABLE` para PostgreSQL/MySQL y deja un aviso si usas otro motor.

> Nota: si cambias el esquema y necesitas limpiar la base PostgreSQL, elimina y recrea la BD con `DROP DATABASE nutrici髇` y `CREATE DATABASE nutrici髇`, o usa tu cliente favorito (pgAdmin, psql, etc.).

### Acceso a la base de datos

- Con Docker: usa `localhost:5434`, usuario `postgres`, clave `postgres`, base `nutrici髇`.
- Sin Docker (seg煤n tu configuraci贸n): usa la URL que hayas definido en `DATABASE_URL`.

#### Caracteristicas

- Calculos de calorias, macros y micronutrientes a partir del catalogo de alimentos.
- Integracion opcional con proveedores externos de datos nutrici髇ales mediante las variables `EXTERNAL_NUTRITION_*`.
- Versionado de dietas por paciente, historial de asignaciones y exportaci髇 CSV/PDF lista para compartir.
- Webhook de notificaciones configurable (`NOTIFICATIONS_SERVICE_URL`) para comunicar cambios al paciente.
- Script de datos de ejemplo (`python scripts/seed_demo.py`) para contar con un escenario base tras iniciar la base de datos.
- Arquitectura preparada para convivir con un API Gateway encargado de autenticacion y autorizacion.
