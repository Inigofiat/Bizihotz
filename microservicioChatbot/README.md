# Microservicio Chatbot (Bizihotz)

API Node.js + Express + MongoDB para gestionar sesiones y mensajes del chatbot de nutricion clinica. Pensado para exponer endpoints REST sencillos que el gateway pueda orquestar.

## Endpoints principales (base `/api`)

- `GET /health`: estado del servicio.
- `POST /sessions`: crea sesion de chatbot para un usuario (`usuarioId`, `titulo?`).
- `GET /sessions?usuarioId=...`: lista sesiones de ese usuario.
- `GET /sessions/:sessionId/messages`: mensajes paginados de una sesion.
- `POST /sessions/:sessionId/messages`: agrega mensaje (`remitenteId`, `contenido`).
- `DELETE /sessions/:sessionId`: elimina la sesion y sus mensajes.
- `POST /sessions/:sessionId/ai-reply`: genera y almacena respuesta del asistente (usa proveedor externo si `AI_API_URL` esta configurado, si no aplica heuristica local).

## Ejecutar en local

```bash
cp .env.example .env
npm install
npm run dev
```

Variables de entorno:

- `PORT` (por defecto 4700)
- `MONGO_URI` (por defecto `mongodb://127.0.0.1:27017/chatbot`)
- `SERVICE_NAME` (por defecto `Bizihotz Chatbot`)
- `ALLOWED_ORIGINS` (coma-separado, `*` para todos)
- `AI_API_URL` / `AI_API_KEY` / `AI_MODEL` (opcional; si se definen, se llama al proveedor externo, si no se usa heuristica local)
- `AI_TIMEOUT_MS` (por defecto 15000)

## Notas

- Persistencia en Mongo usando colecciones `chatbot_sessions` y `chatbot_messages`.
- Incluye heuristica local para respuestas si no hay proveedor de IA configurado. Si se define `AI_API_URL`, se llama al proveedor y se almacena la respuesta como `assistant`.
