"use strict";

const createNotFoundError = (entity = "Recurso", id = "") => {
  const error = new Error(
    id ? `${entity} con identificador ${id} no encontrado.` : `${entity} no encontrado.`
  );
  error.status = 404;
  return error;
};

module.exports = { createNotFoundError };
