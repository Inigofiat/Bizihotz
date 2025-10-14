# Bizihotz

Este repositorio contiene el microservicio de gestión para Bizihotz.

## Ejecución del microservicio de gestión

El código del servicio se encuentra en `microservicioGestion/`. Puedes ejecutarlo de dos maneras:

### 1. Usando Node.js instalado localmente

1. Instala [Node.js 18 o superior](https://nodejs.org/) y asegúrate de que el comando `node` esté disponible en tu terminal.
2. Instala [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) (se incluye automáticamente con el instalador oficial de Node.js).
3. Desde la carpeta `microservicioGestion/`, instala las dependencias:
   ```bash
   npm install
   ```
4. Levanta la base de datos MongoDB localmente o actualiza `MONGO_URI` en el archivo `.env` para apuntar a una instancia disponible.
5. Ejecuta el servicio:
   ```bash
   npm run dev
   ```

> Si tu sistema no reconoce el comando `node`, es porque Node.js no está instalado. Sigue el paso 1 para instalarlo o usa la opción con Docker Compose.

### 2. Usando Docker Compose (sin instalar Node.js en tu máquina)

1. Asegúrate de tener instalados [Docker](https://docs.docker.com/get-docker/) y [Docker Compose](https://docs.docker.com/compose/).
2. Desde `microservicioGestion/`, ejecuta:
   ```bash
   docker compose up --build
   ```
   Esto levantará tanto MongoDB como el microservicio con las dependencias correctas.

El servicio expone la API en el puerto `4001` y la documentación Swagger en `http://localhost:4001/docs`.

## Otros recursos

- Documentación OpenAPI: `microservicioGestion/docs/openapi.json`
- Scripts npm disponibles:
  - `npm start`: ejecuta el servicio en modo producción.
  - `npm run dev`: ejecuta el servicio con recarga automática utilizando `nodemon`.