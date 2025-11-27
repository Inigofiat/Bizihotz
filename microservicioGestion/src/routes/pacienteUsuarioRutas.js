const express = require('express');
const PacienteUsuario = require('../models/pacienteUsuarioModelo');
const { ensureValidObjectId } = require('../utils/validators');
const { createNotFoundError } = require('../utils/httpErrors');

const router = express.Router();

const handleError = (res, error, defaultMessage) => {
  if (error.name === 'ValidationError') {
    return res.status(400).json({ mensaje: error.message });
  }

  const status = error.status || 500;
  const mensaje = error.message || defaultMessage;
  return res.status(status).json({ mensaje });
};

router.get('/', async (req, res) => {
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

    const relaciones = await PacienteUsuario.find(filtro).sort({ createdAt: -1 });
    return res.json(relaciones);
  } catch (error) {
    return handleError(res, error, 'Error al obtener las relaciones');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'relación paciente-usuario');

    const relacion = await PacienteUsuario.findById(id);
    if (!relacion) {
      throw createNotFoundError('Relación paciente-usuario', id);
    }

    return res.json(relacion);
  } catch (error) {
    return handleError(res, error, 'Error al obtener la relación');
  }
});

router.post('/', async (req, res) => {
  try {
    const { idPaciente, idUsuario } = req.body;
    ensureValidObjectId(idPaciente, 'paciente');
    ensureValidObjectId(idUsuario, 'usuario');

    const relacion = new PacienteUsuario(req.body);
    const nuevaRelacion = await relacion.save();
    return res.status(201).json(nuevaRelacion);
  } catch (error) {
    return handleError(res, error, 'Error al crear la relación');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'relación paciente-usuario');

    const eliminada = await PacienteUsuario.findByIdAndDelete(id);
    if (!eliminada) {
      throw createNotFoundError('Relación paciente-usuario', id);
    }

    return res.status(204).send();
  } catch (error) {
    return handleError(res, error, 'Error al eliminar la relación');
  }
});

module.exports = router;
