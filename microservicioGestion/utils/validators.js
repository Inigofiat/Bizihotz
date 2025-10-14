const mongoose = require('mongoose');

const ensureValidObjectId = (value, nombreCampo) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    const error = new Error(`El identificador proporcionado para ${nombreCampo} no es válido`);
    error.status = 400;
    throw error;
  }
};

module.exports = { ensureValidObjectId };