"use strict";

const { Types } = require("mongoose");

const ensureValidObjectId = (id, label = "identificador") => {
  if (!Types.ObjectId.isValid(id)) {
    const error = new Error(`El ${label} no es válido.`);
    error.status = 400;
    throw error;
  }
  return id;
};

module.exports = { ensureValidObjectId };
