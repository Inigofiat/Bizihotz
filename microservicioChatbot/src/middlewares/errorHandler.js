const createError = require('http-errors');
const config = require('../config/env');

module.exports = (err, _req, res, _next) => {
  // Log for troubleshooting
  // eslint-disable-next-line no-console
  console.error('[chatbot] error:', err);
  const isHttp = createError.isHttpError(err);
  const status = isHttp ? err.status : 500;
  const message = err.message || 'Error interno';
  const payload = {
    mensaje: message,
  };
  if (config.env !== 'production') {
    payload.stack = err.stack;
  }
  res.status(status).json(payload);
};
