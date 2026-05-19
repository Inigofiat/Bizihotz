# Microservicio Gestion (Node.js + Express + MongoDB)

Servicio que gestiona pacientes, citas y usuarios. Expone API REST protegida con JWT y sirve ficheros subidos desde `uploads/`. La documentacion Swagger se publica desde `docs/openapi.json`.

## Requisitos

- Node.js 18+ y npm
- MongoDB 6+ accesible (local o contenedor)

## Variables de entorno (`.env`)

- `MONGO_URI` (obligatorio): cadena de conexion a MongoDB. Ej: `mongodb://localhost:27017/gestion`.
- `PORT` (opcional, por defecto `4001`).
- `JWT_SECRET` (opcional, **cambialo en produccion**).
- `JWT_EXPIRATION` (opcional, por defecto `1d`).
- `ALLOW_ANONYMOUS` (opcional, por defecto `false`): si vale `true`, desactiva la validacion JWT y crea un usuario simulado para pruebas locales.
- `ALLOW_ANONYMOUS_ROLE` (opcional, por defecto `Administrador`): rol del usuario simulado (`Administrador`, `Recepcionista`, `Profesional del centro`).
- `DEFAULT_USER_PASSWORD` (opcional, por defecto `Bizihotz2025!`): usada para crear los usuarios iniciales si la coleccion esta vacia.
- `UPLOADS_DIR` (opcional): ruta donde guardar/servir ficheros; por defecto `./uploads` en el proyecto.

## Puesta en marcha rapida (local)

```bash
cd microservicioGestion
cp .env .env.local  # opcional: copia y edita
npm install
npm run dev         # o: npm start
```

API disponible en `http://localhost:4001` (o el puerto configurado). Documentacion Swagger en `http://localhost:4001/docs` y JSON en `/docs/swagger.json`. Endpoints de salud: `GET /status` y `GET /health`.

Al primer arranque, si no hay usuarios, se crean desde `src/models/profesionales.seed.json` con la contrasena `DEFAULT_USER_PASSWORD`. Cambia esa contrasena despues del despliegue.

## Scripts utiles

- `npm test`: ejecuta la bateria de pruebas definida en `package.json`.
- `npm run dev`: arranque con recarga (nodemon).
- `npm start`: arranque en modo produccion.
- `npm run seed`: carga datos de ejemplo (pacientes, citas, historiales, usuarios).
- `npm run purge-weekend-citas`: borra citas en fin de semana (script de limpieza).

Scripts adicionales de apoyo en `scripts/` (`debugWeekendCitas.js`, `findCitasPorFecha.js`, etc.).

## Docker / Compose

El `docker-compose.yml` de la raiz ya define el servicio `gestion` y MongoDB. Para levantar solo este servicio en el stack:

```bash
docker compose up -d --build gestion
```

Asegurate de que `MONGO_URI` apunta al contenedor de Mongo expuesto (por defecto `mongodb://mongo:27017/gestion` dentro de la red de compose).

## Rutas principales

- `GET /status`: salud (incluye estado de la conexion a Mongo).
- `GET /health`: alias de salud.
- `POST /api/auth/login`: login JWT (email o nombreUsuario + password).
- `POST /api/auth/cambiar-password`, `/confirmar-password`, `/logout`.
- `PUT /api/usuarios/:id`: actualizar tu propio perfil (nombre, apellidos, telefono, email, nombreUsuario, rol).
- CRUD protegido para `pacientes`, `citas`, `historiales`, `registros`, `pacientes-usuarios`, `usuarios` bajo `/api/...`.
- `GET /docs`: Swagger UI (requiere `docs/openapi.json` presente).

> Todas las rutas (salvo `/status`, `/health` y `/api/auth/*`) requieren header `Authorization: Bearer <token>`.
