const { validationResult } = require('express-validator');
const createError = require('http-errors');

const validateRequest = (req, _res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const formatted = errors.array().map((error) => ({
    field: error.param,
    value: error.value,
    message: error.msg,
    location: error.location,
  }));

  return next(
    createError(422, 'Solicitud invalida. Revisa los campos enviados.', {
      details: formatted,
    })
  );
};

module.exports = validateRequest;
