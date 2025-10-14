require('dotenv').config();
const express = require('express');
const { connectDB } = require('./config/db');
const pacienteRoutes = require('./routes/pacienteRoutes');
const citaRoutes = require('./routes/citaRoutes');
const historialRoutes = require('./routes/historialRoutes');
const registroRoutes = require('./routes/registroRoutes');
const pacienteUsuarioRoutes = require('./routes/pacienteUsuarioRoutes');
const swaggerDocument = require('./docs/openapi.json');

const PORT = process.env.PORT || 4001;
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/pacientes', pacienteRoutes);
app.use('/api/citas', citaRoutes);
app.use('/api/historiales', historialRoutes);
app.use('/api/registros', registroRoutes);
app.use('/api/pacientes-usuarios', pacienteUsuarioRoutes);

app.get('/docs/swagger.json', (_req, res) => {
  res.json(swaggerDocument);
});

app.get('/docs', (_req, res) => {
  res.send(`<!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Bizihotz · Documentación API</title>
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
  app.listen(PORT, () => {
    console.log(`Microservicio de gestión escuchando en el puerto ${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };