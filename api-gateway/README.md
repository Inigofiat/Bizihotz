# Bizihotz · API Gateway

Gateway HTTP que centraliza el acceso del frontend a los microservicios de Bizihotz. Se encarga de:

- aplicar middlewares comunes (parseo JSON, CORS, logging si se necesita),
- hacer proxy hacia los microservicios existentes (`/gestion`, `/nutricion`, etc.),
- exponer un `healthcheck` unificado y la documentación OpenAPI agregada.

## Requisitos

- Node.js ≥ 18
- Cada microservicio en ejecución (por defecto se espera `http://localhost:4001` para gestión y `http://localhost:5002` para nutrición).

## Instalación

```bash
cd api-gateway
cp .env.example .env   # ajusta URLs si es necesario
npm install
```

## Ejecución

```bash
npm run dev            # recarga con nodemon
# o
npm start
```

### Endpoints expuestos

- `GET /health`: devuelve el estado del gateway y la configuración cargada.
- `GET /openapi.json`: genera y devuelve la documentación OpenAPI agregada a partir de los microservicios disponibles.
- `GET /docs`: interfaz Swagger UI que consume el `openapi.json` anterior.
- Rutas proxy:
  - `/gestion/*` → microservicio de gestión (Node.js + MongoDB).
  - `/nutricion/*` → microservicio de nutrición (FastAPI + PostgreSQL).
  - `/comunicacion/*` y `/documentos/*` quedan preparados para cuando esos microservicios estén disponibles.

## Estructura del proyecto

```
api-gateway/
├── .env.example
├── package.json
├── README.md
└── src
    ├── index.js
    ├── lib
    │   ├── config.js
    │   └── openapiAggregator.js
    └── middleware
        └── errorHandler.js
```

## Notas

- Si alguno de los microservicios no está disponible, el gateway sigue funcionando y simplemente omite sus rutas en la documentación agregada.
- Puedes añadir autenticación/autorización global aquí antes de reenviar la petición al microservicio correspondiente.
