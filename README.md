# Bizihotz

Plataforma Bizihotz compuesta por varios microservicios (gestion clinica, nutricion, API Gateway FastAPI y frontend estatico). Puedes ejecutar todo el ecosistema con Docker Compose o iniciar cada pieza de manera independiente en tu maquina.

## Mapa rapido de servicios

| Servicio              | Stack / runtime        | Host:Puerto        | Carpeta o servicio |
|-----------------------|------------------------|--------------------|--------------------|
| MongoDB               | Mongo 6                | `27018 -> 27017`   | `docker-compose.yml` (`mongo`) |
| microservicioGestion  | Node.js 18 + Express   | `4002 -> 4001`     | `microservicioGestion/` |
| microservicioComunicacion | Node.js 18 + Express + Socket.IO | `4103 -> 4100` | `microservicioComunicacion/` |
| PostgreSQL            | Postgres 16            | `5435 -> 5432`     | `docker-compose.yml` (`postgres`) |
| microservicioNutricion| FastAPI + SQLAlchemy   | `5002`             | `microservicioNutricion/` |
| microservicioDocumental| FastAPI + SQLAlchemy  | `5100`             | `microservicioDocumental/` |
| API Gateway           | FastAPI                | `5000`             | `api-gateway/` |
| Frontend              | HTML/CSS/JS estatico   | `8080`             | `web/` |

## Tecnologias por servicio

- **API Gateway (`api-gateway/`)**: FastAPI + Uvicorn para orquestar, `httpx` como cliente HTTP asincrono y `python-dotenv` para configuracion por entorno.
- **microservicioGestion (`microservicioGestion/`)**: Node.js 18, Express 5, MongoDB 6 con Mongoose, autenticacion JWT (`jsonwebtoken`), CORS y carga de ficheros con Multer.
- **microservicioComunicacion (`microservicioComunicacion/`)**: Node.js 18, Express 5, Socket.IO para tiempo real, MongoDB con Mongoose, middleware de seguridad (helmet) y validacion con `express-validator`.
- **microservicioNutricion (`microservicioNutricion/`)**: FastAPI, SQLAlchemy 2, PostgreSQL 16, Pydantic v2, Uvicorn y utilidades HTTP (`requests`/`httpx`) y generacion de PDF (`fpdf2`).
- **microservicioDocumental (`microservicioDocumental/`)**: FastAPI, SQLAlchemy 2 + Alembic, PostgreSQL 16 y `httpx` para llamadas salientes si se requieren integraciones.
- **Frontend (`web/`)**: HTML, CSS y JS plano (estatico); consume el gateway via llamadas fetch.

## Requisitos base

- **Para el stack Docker**: Docker Desktop (o Engine) con Docker Compose v2.
- **Para la ejecucion manual**:
  - Node.js 18+ y npm.
  - Python 3.11+, `pip` y `uvicorn`.
  - Acceso a MongoDB 6+ y PostgreSQL 16+ (locales o en contenedor).
  - Alguna utilidad para servir archivos estaticos (`npx serve`, `python -m http.server`, etc.).

## Camino 1: arranque rapido con Docker Compose

1. Copia y personaliza las variables necesarias en el archivo `.env` de la raiz si quieres cambiar puertos o URLs del gateway.
2. Lanza todos los servicios:
   ```bash
   docker compose up -d --build
   ```
3. Accede a:
   - Frontend: http://localhost:8080
   - API Gateway: http://localhost:5000 (docs en `/docs`, health en `/health`)
   - Microservicio de gestion: http://localhost:4002 (el contenedor expone 4001, se publica en 4002)
   - Microservicio de comunicacion: http://localhost:4103 (contenedor en 4100, publicado en 4103)
   - Microservicio de nutricion: http://localhost:5002
   - Microservicio documental: http://localhost:5100
   - MongoDB: `mongodb://localhost:27018`
   - PostgreSQL: `postgresql://postgres:postgres@localhost:5435/nutricion`
4. Registra los logs cuando lo necesites:
   ```bash
   docker compose logs -f api-gateway
   docker compose logs -f gestion
   docker compose logs -f comunicacion
   ```
5. Para detener y limpiar:
   ```bash
   docker compose down        
   docker compose down -v   
   ```

> Si quieres desarrollar con recarga en vivo, deja el stack levantado con `docker compose up` para las bases de datos y arranca los servicios de aplicacion de manera manual.

## Camino 2: ejecutar cada componente por separado

Orden recomendado: bases de datos -> microservicios -> gateway -> frontend.

### MongoDB

Puedes usar una instancia local instalada o lanzar un contenedor aislado:

```bash
docker run --name mongo-bizihotz -p 27017:27017 -v mongo_data:/data/db -d mongo:6
```

Actualiza `microservicioGestion/.env` con la cadena correcta (`MONGO_URI`).

### microservicioGestion (Node.js)

```bash
cd microservicioGestion
cp .env.example .env 
npm install
MONGO_URI=mongodb://localhost:27017/gestion npm run dev
```

- API local en `http://localhost:4001`
- Documentacion Swagger: `http://localhost:4001/docs`
- Scripts utiles: `npm run seed` para datos de prueba.

### microservicioComunicacion (Node.js + Socket.IO)

```bash
cd microservicioComunicacion
cp .env.example .env
npm install
npm run dev
```

- API local en `http://localhost:4100`
- Documentacion Swagger: `http://localhost:4100/docs`
- Canal tiempo real: conectar via Socket.IO (`io('http://localhost:4100', { auth: { userId: '<id>' } })`)

### PostgreSQL

Si no tienes Postgres local, lanza uno rapido:

```bash
docker run --name postgres-bizihotz -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nutricion -p 5432:5432 -v postgres_data:/var/lib/postgresql/data -d postgres:16
```

Guarda la URL en `microservicioNutricion/.env` (variable `DATABASE_URL`).

### microservicioNutricion (FastAPI)

```bash
cd microservicioNutricion
cp .env.example .env
python -m venv .venv
source .venv/bin/activate        
pip install -r requirements.txt
uvicorn app:app --reload --port 5002
```

- Endpoint de salud: `GET http://localhost:5002/health`
- Semilla opcional: `python scripts/seed_demo.py`
- Documentacion: ver `microservicioNutricion/README.md` para scripts adicionales.

### microservicioDocumental (FastAPI)

```bash
cd microservicioDocumental
cp .env.example .env
python -m venv .venv
source .venv/bin/activate        
pip install -r requirements.txt
uvicorn app:app --reload --port 5100
```

- Por defecto usa el Postgres del stack (`postgresql+psycopg://postgres:postgres@localhost:5435/nutricion`). Cambia `DATABASE_URL` si usas otra instancia o el `docker-compose` de esta carpeta (que expone Postgres en `5440`).
- Endpoints: `http://localhost:5100/health`, `/api/documentos`, `/docs`.

### API Gateway (FastAPI)

```bash
cd api-gateway
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```

Verifica que las variables `GESTION_*`, `NUTRICION_*`, `COMUNICACION_*` y `DOCUMENTOS_*` apunten a las URLs locales que arrancaste previamente.

### Frontend web

Los archivos estan en `web/` y son estaticos. Puedes servirlos con cualquier servidor sencillo:

```bash
npx serve ./web -l 8080
# o
python -m http.server 8080 -d web
```

Configura las variables de entorno del frontend (en los archivos JS) si necesitas apuntar a URLs distintas para el gateway.
La pagina de documentos (`web/pages/documentos.html`) consulta el microservicio documental via gateway (`/documentos/api/documentos`), asi que debe estar levantado para ver contenido.

## Recursos adicionales

- Detalles especificos de cada microservicio: consulta los README dentro de `microservicioGestion/`, `microservicioComunicacion/`, `microservicioNutricion/`, `microservicioDocumental/` y `api-gateway/`.
- Documentacion del repositorio documental: `microservicioDocumental/README.md`.
- Scripts y seeds: disponibles en `microservicioGestion/data`, `microservicioNutricion/scripts` y en los paquetes npm/python correspondientes.
- Variables globales del gateway: editar `./.env`.

Si surge cualquier duda al mezclar los dos enfoques (Docker + servicios locales), prioriza mantener una sola fuente para cada base de datos y actualiza las URLs de entorno para que todos los componentes apunten al mismo origen.
