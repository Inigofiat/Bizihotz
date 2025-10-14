const express = require('express');
const Cita = require('../data/citaModel');
const { ensureValidObjectId } = require('../utils/validators');
const { createNotFoundError } = require('../utils/httpErrors');

const router = express.Router();

const parseFecha = (valor, nombreCampo) => {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    const error = new Error(`El parámetro ${nombreCampo} debe ser una fecha válida`);
    error.status = 400;
    throw error;
  }
  return fecha;
};

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
    const { idPaciente, idUsuario, fechaDesde, fechaHasta, atendida } = req.query;
    const filtro = {};

    if (idPaciente) {
      ensureValidObjectId(idPaciente, 'paciente');
      filtro.idPaciente = idPaciente;
    }

    if (idUsuario) {
      ensureValidObjectId(idUsuario, 'usuario');
      filtro.idUsuario = idUsuario;
    }

    if (typeof atendida !== 'undefined') {
      if (!['true', 'false'].includes(String(atendida))) {
        const error = new Error('El parámetro atendida debe ser true o false');
        error.status = 400;
        throw error;
      }
      filtro.atendida = String(atendida) === 'true';
    }

    if (fechaDesde || fechaHasta) {
      filtro.fechaCita = {};
      if (fechaDesde) {
        filtro.fechaCita.$gte = parseFecha(fechaDesde, 'fechaDesde');
      }
      if (fechaHasta) {
        filtro.fechaCita.$lte = parseFecha(fechaHasta, 'fechaHasta');
      }
    }

    const citas = await Cita.find(filtro).sort({ fechaCita: 1, hora: 1 });
    return res.json(citas);
  } catch (error) {
    return handleError(res, error, 'Error al obtener las citas');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'cita');

    const cita = await Cita.findById(id);
    if (!cita) {
      throw createNotFoundError('Cita', id);
    }

    return res.json(cita);
  } catch (error) {
    return handleError(res, error, 'Error al obtener la cita');
  }
});

router.post('/', async (req, res) => {
  try {
    const { idPaciente, idUsuario } = req.body;
    ensureValidObjectId(idPaciente, 'paciente');
    ensureValidObjectId(idUsuario, 'usuario');

    const cita = new Cita(req.body);
    const nuevaCita = await cita.save();
    return res.status(201).json(nuevaCita);
  } catch (error) {
    return handleError(res, error, 'Error al crear la cita');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'cita');

    if (req.body.idPaciente) {
      ensureValidObjectId(req.body.idPaciente, 'paciente');
    }
    if (req.body.idUsuario) {
      ensureValidObjectId(req.body.idUsuario, 'usuario');
    }

    const actualizada = await Cita.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!actualizada) {
      throw createNotFoundError('Cita', id);
    }

    return res.json(actualizada);
  } catch (error) {
    return handleError(res, error, 'Error al actualizar la cita');
  }
});

router.patch('/:id/atendida', async (req, res) => {
  try {
    const { id } = req.params;
    const { atendida } = req.body;

    if (typeof atendida !== 'boolean') {
      const error = new Error('El campo atendida debe ser booleano');
      error.status = 400;
      throw error;
    }

    ensureValidObjectId(id, 'cita');

    const actualizada = await Cita.findByIdAndUpdate(
      id,
      { atendida },
      { new: true, runValidators: true }
    );

    if (!actualizada) {
      throw createNotFoundError('Cita', id);
    }

    return res.json(actualizada);
  } catch (error) {
    return handleError(res, error, 'Error al actualizar el estado de la cita');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'cita');

    const eliminada = await Cita.findByIdAndDelete(id);
    if (!eliminada) {
      throw createNotFoundError('Cita', id);
    }

    return res.status(204).send();
  } catch (error) {
    return handleError(res, error, 'Error al eliminar la cita');
  }
});

module.exports = router;