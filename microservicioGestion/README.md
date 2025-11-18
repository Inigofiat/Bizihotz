# Bizihotz - microservicio de gestion

Servicio REST en Node.js 18 + Express que administra profesionales, pacientes, citas y registros clinicos dentro del ecosistema Bizihotz. Usa MongoDB como base principal y publica su OpenAPI para el gateway.

## Variables clave

- `PORT`: puerto HTTP del microservicio (por defecto `4001`).
- `MONGO_URI`: cadena de conexion hacia MongoDB (ejemplo `mongodb://localhost:27017/gestion`).
- `DEFAULT_USER_PASSWORD`: clave inicial que reciben los profesionales creados via seed.
- `JWT_SECRET`, `JWT_EXPIRATION`, `MAIL_*` y demas opciones se documentan en el `.env`.

> Copia y ajusta el `.env` existente antes de poner el servicio en marcha.

## Requisitos

- Node.js 18 o superior (incluye npm).
- Acceso a MongoDB 6+ (puede vivir en Docker, Atlas o local).
- Docker Desktop/Compose si deseas usar los contenedores provistos.

## Arranque local (Node.js)

```bash
cd microservicioGestion
npm install
npm run dev
```

Asegurate de que `MONGO_URI` apunte a tu instancia (por ejemplo `mongodb://localhost:27017/gestion`). El modo `dev` ejecuta `nodemon` para recargar al guardar.

## Arranque contenerizado

```bash
cd microservicioGestion
docker compose up --build
```

Este archivo define:

- `mongo`: instancia basica de MongoDB con volumen persistente.
- `gestion`: microservicio levantado en modo desarrollo (`npm run dev`).

Consulta los logs con `docker compose logs -f gestion` y detiene todo con `docker compose down`.

## Endpoints utiles

- Base URL: `http://localhost:4001`
- Documentacion Swagger/UI: `http://localhost:4001/docs`
- OpenAPI JSON para el gateway: `docs/openapi.json`

## Scripts npm

- `npm run dev`: desarrollo con recarga.
- `npm start`: modo produccion.
- `npm run seed`: limpia colecciones e importa datos de ejemplo (profesionales, pacientes, citas, historiales y registros). Las contrasenas generadas usan `DEFAULT_USER_PASSWORD`; cambiala o actualiza los usuarios despues de sembrar datos.

## Politicas de acceso y seguridad

- Se usan hashes bcrypt (12 rondas) para todas las credenciales.
- Si la coleccion `usuarios` esta vacia al iniciar, se pobla con los profesionales definidos en `data/profesionales.seed.json`.
- Los usuarios pueden cambiar su contrasena mediante `POST /api/auth/cambiar-password`.
