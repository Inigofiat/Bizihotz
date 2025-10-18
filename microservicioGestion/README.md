# Bizihotz

Este repositorio contiene el microservicio de gestion para Bizihotz.

## Ejecucion del microservicio de gestion

El codigo del servicio se encuentra en `microservicioGestion/`. Puedes ejecutarlo de dos maneras:

### 1. Usando Node.js instalado localmente

1. Instala [Node.js 18 o superior](https://nodejs.org/) y asegurate de que el comando `node` este disponible en tu terminal.
2. Instala [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) (se incluye automaticamente con el instalador oficial de Node.js).
3. Desde la carpeta `microservicioGestion/`, instala las dependencias:
   ```bash
   npm install
   ```
4. Levanta la base de datos MongoDB localmente o actualiza `MONGO_URI` en el archivo `.env` para apuntar a una instancia disponible.
5. Ejecuta el servicio:
   ```bash
   npm run dev
   ```

> Si tu sistema no reconoce el comando `node`, es porque Node.js no esta instalado. Sigue el paso 1 para instalarlo o usa la opcion con Docker Compose.

### 2. Usando Docker Compose (sin instalar Node.js en tu maquina)

1. Asegurate de tener instalados [Docker](https://docs.docker.com/get-docker/) y [Docker Compose](https://docs.docker.com/compose/).
2. Desde `microservicioGestion/`, ejecuta:
   ```bash
   docker compose up --build
   ```
   Esto levantara tanto MongoDB como el microservicio con las dependencias correctas.

El servicio expone la API en el puerto `4001` y la documentacion Swagger en `http://localhost:4001/docs`.

## Otros recursos

- Documentacion OpenAPI: `microservicioGestion/docs/openapi.json`
- Scripts npm disponibles:
  - `npm start`: ejecuta el servicio en modo produccion.
  - `npm run dev`: ejecuta el servicio con recarga automatica utilizando `nodemon`.
  - `npm run seed`: limpia las colecciones y carga datos de ejemplo (profesionales, pacientes, citas, historiales y registros).
    - Las contrasenas iniciales de los profesionales corresponden a `Bizihotz2025!` y se importan desde `data/profesionales.seed.json`. El archivo guarda �nicamente los hashes; si necesitas otra clave deberas generar un nuevo hash antes de ejecutar el seed.

## Credenciales y politicas de acceso

- Las contrasenas se almacenan solo en formato hash (bcrypt, 12 rondas). Cada profesional puede mantener la clave inicial o cambiarla tras su primer acceso.
- Cada profesional tiene los atributos definidos por el modelo de datos (`nombreUsuario`, `email`, `telefono`, `rol`, `foto`, ...).
- Los usuarios pueden cambiar su contrasena mediante `POST /api/auth/cambiar-password` si el administrador lo solicita.
- En el arranque el servicio verifica si la coleccion `usuarios` esta vacia; si lo esta, importa los profesionales definidos en `data/profesionales.seed.json`. Puedes definir la clave inicial mediante la variable de entorno `DEFAULT_USER_PASSWORD` (por defecto `Bizihotz2025!`). Cambia esta variable o la contrasena de los usuarios tras cada despliegue.
