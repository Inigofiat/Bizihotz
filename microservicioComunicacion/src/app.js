const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const createError = require('http-errors');
const config = require('./config/env');
const messageRoutes = require('./routes/messageRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const healthRoutes = require('./routes/healthRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

const allowAll = config.socketAllowedOrigins.includes('*');

app.use(
  cors({
    origin: (origin, callback) => {
      if (allowAll || !origin || config.socketAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
app.use('/uploads', express.static(config.uploadsDir));

app.use('/health', healthRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);

app.get('/docs/swagger.json', (_req, res) => {
  const specPath = path.join(__dirname, '..', 'docs', 'openapi.json');
  return res.sendFile(specPath);
});

app.get('/docs', (_req, res) => {
  res.send(`<!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>${config.serviceName} - Documentacion</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
      <style>
        body { margin: 0; background-color: #f7fafc; }
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

app.use((_req, _res, next) => {
  next(createError(404, 'Ruta no encontrada'));
});

app.use(errorHandler);

module.exports = app;
