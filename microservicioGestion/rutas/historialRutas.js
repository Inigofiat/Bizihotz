const express = require('express');
const HistorialPaciente = require('../data/historialPacienteModel');
const { ensureValidObjectId } = require('../utils/validators');
const { createNotFoundError } = require('../utils/httpErrors');

const router = express.Router();

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
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
    const { idPaciente, idUsuario, idCita, page, limit } = req.query;
    const filtro = {};

    if (idPaciente) {
      ensureValidObjectId(idPaciente, 'paciente');
      filtro.idPaciente = idPaciente;
    }
    if (idUsuario) {
      ensureValidObjectId(idUsuario, 'usuario');
      filtro.idUsuario = idUsuario;
    }
    if (idCita) {
      ensureValidObjectId(idCita, 'cita');
      filtro.idCita = idCita;
    }

    const pageNumber = parsePositiveInt(page, null);
    const pageSize = parsePositiveInt(limit, null);
    const size = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    if (pageNumber || pageSize) {
      const currentPage = pageNumber || 1;
      const skip = (currentPage - 1) * size;

      const [total, items] = await Promise.all([
        HistorialPaciente.countDocuments(filtro),
        HistorialPaciente.find(filtro)
          .sort({ fechaActualizacion: -1 })
          .skip(skip)
          .limit(size)
      ]);

      return res.json({
        items,
        total,
        page: currentPage,
        pageSize: size,
        pages: Math.max(1, Math.ceil(total / size))
      });
    }

    const historiales = await HistorialPaciente.find(filtro)
      .sort({ fechaActualizacion: -1 })
      .limit(size);
    return res.json(historiales);
  } catch (error) {
    return handleError(res, error, 'Error al obtener los historiales');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'historial');

    const historial = await HistorialPaciente.findById(id);
    if (!historial) {
      throw createNotFoundError('Historial del paciente', id);
    }

    return res.json(historial);
  } catch (error) {
    return handleError(res, error, 'Error al obtener el historial');
  }
});

router.post('/', async (req, res) => {
  try {
    const { idPaciente, idUsuario, idCita } = req.body;
    ensureValidObjectId(idPaciente, 'paciente');
    ensureValidObjectId(idUsuario, 'usuario');
    ensureValidObjectId(idCita, 'cita');

    const historial = new HistorialPaciente(req.body);
    const nuevo = await historial.save();
    return res.status(201).json(nuevo);
  } catch (error) {
    return handleError(res, error, 'Error al crear el historial');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'historial');

    const { idPaciente, idUsuario, idCita } = req.body;
    if (idPaciente) ensureValidObjectId(idPaciente, 'paciente');
    if (idUsuario) ensureValidObjectId(idUsuario, 'usuario');
    if (idCita) ensureValidObjectId(idCita, 'cita');

    const actualizado = await HistorialPaciente.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!actualizado) {
      throw createNotFoundError('Historial del paciente', id);
    }

    return res.json(actualizado);
  } catch (error) {
    return handleError(res, error, 'Error al actualizar el historial');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'historial');

    const eliminado = await HistorialPaciente.findByIdAndDelete(id);
    if (!eliminado) {
      throw createNotFoundError('Historial del paciente', id);
    }

    return res.status(204).send();
  } catch (error) {
    return handleError(res, error, 'Error al eliminar el historial');
  }
});

module.exports = router;
