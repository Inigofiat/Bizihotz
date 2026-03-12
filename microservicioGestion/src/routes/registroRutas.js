const express = require('express');
const RegistroAntropometrico = require('../models/registroAntropometricoModel');
const { ensureValidObjectId } = require('../utils/validators');
const { createNotFoundError } = require('../utils/httpErrors');
const { permitirRoles, ROLES } = require('../middlewares/authorize');

const router = express.Router();

const handleError = (res, error, defaultMessage) => {
  if (error.name === 'ValidationError') {
    return res.status(400).json({ mensaje: error.message });
  }

  const status = error.status || 500;
  const mensaje = error.message || defaultMessage;
  return res.status(status).json({ mensaje });
};

router.get('/', permitirRoles(ROLES.ADMIN, ROLES.PROFESIONAL), async (req, res) => {
  try {
    const { idPaciente, idUsuario } = req.query;
    const filtro = {};

    if (idPaciente) {
      ensureValidObjectId(idPaciente, 'paciente');
      filtro.idPaciente = idPaciente;
    }
    if (idUsuario) {
      ensureValidObjectId(idUsuario, 'usuario');
      filtro.idUsuario = idUsuario;
    }

    const registros = await RegistroAntropometrico.find(filtro).sort({ fechaMedicion: -1 });
    return res.json(registros);
  } catch (error) {
    return handleError(res, error, 'Error al obtener los registros');
  }
});

router.get('/:id', permitirRoles(ROLES.ADMIN, ROLES.PROFESIONAL), async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'registro antropométrico');

    const registro = await RegistroAntropometrico.findById(id);
    if (!registro) {
      throw createNotFoundError('Registro antropométrico', id);
    }

    return res.json(registro);
  } catch (error) {
    return handleError(res, error, 'Error al obtener el registro');
  }
});

router.post('/', permitirRoles(ROLES.ADMIN, ROLES.PROFESIONAL), async (req, res) => {
  try {
    const { idPaciente, idUsuario } = req.body;
    ensureValidObjectId(idPaciente, 'paciente');
    ensureValidObjectId(idUsuario, 'usuario');

    const registro = new RegistroAntropometrico(req.body);
    const nuevo = await registro.save();
    return res.status(201).json(nuevo);
  } catch (error) {
    return handleError(res, error, 'Error al crear el registro');
  }
});

router.put('/:id', permitirRoles(ROLES.ADMIN, ROLES.PROFESIONAL), async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'registro antropométrico');

    const { idPaciente, idUsuario } = req.body;
    if (idPaciente) ensureValidObjectId(idPaciente, 'paciente');
    if (idUsuario) ensureValidObjectId(idUsuario, 'usuario');

    const actualizado = await RegistroAntropometrico.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!actualizado) {
      throw createNotFoundError('Registro antropométrico', id);
    }

    return res.json(actualizado);
  } catch (error) {
    return handleError(res, error, 'Error al actualizar el registro');
  }
});

router.delete('/:id', permitirRoles(ROLES.ADMIN, ROLES.PROFESIONAL), async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'registro antropométrico');

    const eliminado = await RegistroAntropometrico.findByIdAndDelete(id);
    if (!eliminado) {
      throw createNotFoundError('Registro antropométrico', id);
    }

    return res.status(204).send();
  } catch (error) {
    return handleError(res, error, 'Error al eliminar el registro');
  }
});

module.exports = router;
