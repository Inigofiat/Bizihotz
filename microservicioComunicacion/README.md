# Microservicio de Comunicación Interna (M3)

Microservicio Node.js + Express encargado de la mensajería entre profesionales de Bizihotz. Expone una API REST y un canal WebSocket (Socket.IO) para obtener notificaciones en tiempo real (eventos `message:new`, `message:read`, `conversation:read`).

## Requisitos

- Node.js 18+
- MongoDB 6+ (comparte instancia con el microservicio de gestión, pero usa la base `comunicacion`)

## Configuración rápida

```bash
cd microservicioComunicacion
cp .env.example .env           # revisa los valores
npm install                    # ya ejecutado si vienes del repo
npm run dev                    # nodemon en puerto 4100
```

Variables relevantes (`.env`):

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto HTTP | `4100` |
| `MONGO_URI` | Cadena de conexión a MongoDB | `mongodb://127.0.0.1:27017/comunicacion` |
| `SERVICE_NAME` | Nombre presentado en salud y docs | `Bizihotz Comunicacion Interna` |
| `SOCKET_ALLOWED_ORIGINS` | Lista separada por comas para CORS/Socket.IO | `*` |

Scripts npm:

- `npm start`: arranque en modo producción.
- `npm run dev`: nodemon con recarga en caliente.

## Endpoints principales

- `GET /health`: estado del servicio.
- `POST /api/messages`: envía mensaje (crea conversación si no existe).
- `PATCH /api/messages/:messageId/read`: marca un mensaje como leído.
- `GET /api/conversations?userId=...`: conversaciones del usuario ordenadas por actividad.
- `GET /api/conversations/:conversationId/messages`: mensajes paginados (`page`, `limit`).
- `PATCH /api/conversations/:conversationId/read`: marca toda la conversación como leída.
- `GET /docs`: Swagger UI (especificación en `/docs/swagger.json`).

## Tiempo real

Conéctate a `ws://<host>:4100/socket.io/?userId=<id>` (o usando `io("url", { auth: { userId } })`). Eventos disponibles:

| Evento | Dirección | Descripción |
|--------|-----------|-------------|
| `connection:ready` | servidor → cliente | Confirma conexión y `userId`. |
| `message:send` | cliente → servidor | Payload igual al `POST /api/messages`. Respuesta por callback opcional. |
| `message:new` | servidor → cliente | Notifica a remitente/destinatario de un nuevo mensaje. |
| `message:read` | bidireccional | Cliente anuncia lectura (`{ messageId }`), servidor replica estado actualizado. |
| `conversation:read` | bidireccional | Marca toda la conversación como leída y actualiza contadores. |

## Docker

El `docker-compose.yml` raíz ya incluye el servicio (`comunicacion`). Para levantar todo el ecosistema:

```bash
docker compose up -d --build comunicacion
```

El contenedor expone `4103` hacia tu máquina (`4100` interno). El API Gateway lo consume en `http://comunicacion:4100`.
