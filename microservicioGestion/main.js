require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const { connectDB } = require('./config/db');
const pacienteRutas = require('./rutas/pacienteRutas');
const citaRutas = require('./rutas/citasRutas');
const historialRoutes = require('./rutas/historialRutas');
const registroRoutes = require('./rutas/registroRutas');
const pacienteUsuarioRoutes = require('./rutas/pacienteUsuarioRutas');
const authRoutes = require('./rutas/authRutas');
const usuarioRoutes = require('./rutas/usuarioRutas');
const { ensureDefaultUsers } = require('./services/ensureDefaultUsers');

const PORT = process.env.PORT || 4001;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsBase = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), 'uploads');

const uploadsPath = path.join(uploadsBase);
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

let swaggerDocument = null;
const swaggerPath = path.join(__dirname, 'docs', 'openapi.json');

try {
  const rawSpec = fs.readFileSync(swaggerPath, 'utf-8');
  swaggerDocument = JSON.parse(rawSpec);
} catch (error) {
  console.warn(
    '[Swagger] No se pudo cargar docs/openapi.json. La documentación Swagger quedará deshabilitada.',
    error.message
  );
}

const healthCheck = async (_req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: 'degraded', db: 'disconnected' });
  }

  try {
    await mongoose.connection.db.admin().command({ ping: 1 });
    return res.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    return res.status(503).json({
      status: 'degraded',
      db: 'error',
      detalle: error.message
    });
  }
};

app.get('/status', healthCheck);

app.use('/api/pacientes', pacienteRutas);
app.use('/api/citas', citaRutas);
app.use('/api/historiales', historialRoutes);
app.use('/api/registros', registroRoutes);
app.use('/api/pacientes-usuarios', pacienteUsuarioRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);

app.get('/docs/swagger.json', (_req, res) => {
  if (!swaggerDocument) {
    return res.status(503).json({
      mensaje: 'Documentación Swagger no disponible actualmente'
    });
  }

  res.json(swaggerDocument);
});

app.get('/docs', (_req, res) => {
  if (!swaggerDocument) {
    return res
      .status(503)
      .send('<h1>Documentación Swagger no disponible</h1><p>Revisa docs/openapi.json.</p>');
  }

  res.send(`<!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Bizihotz - Documentación API</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
      <style>
        body { margin: 0; background-color: #fafafa; }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
      <script>
        window.addEventListener('load', () => {
          window.ui = SwaggerUIBundle({
            url: '/docs/swagger.json',
            dom_id: '#swagger-ui',
            presets: [SwaggerUIBundle.presets.apis],
            layout: 'BaseLayout'
          });
        });
      </script>
    </body>
  </html>`);
});

app.use((req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

app.use((error, _req, res, _next) => {
  if (error.name === 'ValidationError') {
    return res.status(400).json({ mensaje: error.message });
  }

  const status = error.status || 500;
  const mensaje = error.message || 'Error interno del servidor';

  if (process.env.NODE_ENV !== 'test') {
    console.error(error);
  }

  return res.status(status).json({ mensaje });
});

const startServer = async () => {
  await connectDB();

  try {
    const inicializados = await ensureDefaultUsers();
    if (inicializados) {
      console.log('[Bootstrap] Coleccion usuarios inicializada. Cambia DEFAULT_USER_PASSWORD tras el despliegue.');
    }
  } catch (error) {
    console.error('[Bootstrap] No se pudieron crear los usuarios iniciales:', error.message);
  }

  app.listen(PORT, () => {
    console.log(`Microservicio de gestion escuchando en el puerto ${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
