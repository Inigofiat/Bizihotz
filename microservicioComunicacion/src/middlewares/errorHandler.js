const createError = require('http-errors');
const config = require('../config/env');

const errorHandler = (err, _req, res, _next) => {
  const status =
    err.status ||
    err.statusCode ||
    (err.name === 'ValidationError' ? 400 : err.name === 'CastError' ? 400 : 500);

  let message = err.message || 'Error interno del servidor';
  if (status === 500 && !err.expose) {
    message = 'Error inesperado al procesar la solicitud';
  }

  if (config.env !== 'test' && status >= 500) {
    console.error('[Comunicacion] Error no controlado:', err);
  }

  const payload = {
    message,
  };

  if (err.details) {
    payload.details = err.details;
  }

  if (createError.isHttpError && createError.isHttpError(err) && err.errors) {
    payload.errors = err.errors;
  }

  return res.status(status).json(payload);
};

module.exports = errorHandler;
