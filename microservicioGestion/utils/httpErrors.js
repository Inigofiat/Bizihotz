const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const createNotFoundError = (recurso, id) =>
  createHttpError(404, `${recurso} con identificador ${id} no existe`);

module.exports = { createHttpError, createNotFoundError };