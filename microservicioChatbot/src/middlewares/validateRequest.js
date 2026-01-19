const { validationResult } = require('express-validator');
const createError = require('http-errors');

module.exports = (req, _res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const message = errors
    .array()
    .map((err) => err.msg)
    .filter(Boolean)
    .join('; ');
  return next(createError(400, message || 'Peticion invalida'));
};
