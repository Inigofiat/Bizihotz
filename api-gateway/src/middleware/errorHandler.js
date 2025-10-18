"use strict";

const errorHandler = (err, _req, res, _next) => {
  const status = err.status ?? 500;
  const payload = {
    error: err.name ?? "Error",
    message: err.message ?? "Error interno en el API Gateway"
  };

  if (process.env.NODE_ENV !== "production" && err.stack) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
};

module.exports = {
  errorHandler
};
