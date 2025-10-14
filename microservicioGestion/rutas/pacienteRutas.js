const express = require('express');
const Paciente = require('../data/pacienteModel');
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
    const { buscar } = req.query;
    const filtro = {};

    if (buscar) {
      const regex = new RegExp(buscar, 'i');
      filtro.$or = [
        { nombrePaciente: regex },
        { apellidos: regex },
        { emailPaciente: regex },
      ];
    }

    const pacientes = await Paciente.find(filtro).sort({ createdAt: -1 });
    return res.json(pacientes);
  } catch (error) {
    return handleError(res, error, 'Error al obtener los pacientes');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'paciente');

    const paciente = await Paciente.findById(id);
    if (!paciente) {
      throw createNotFoundError('Paciente', id);
    }

    return res.json(paciente);
  } catch (error) {
    return handleError(res, error, 'Error al obtener el paciente');
  }
});

router.post('/', async (req, res) => {
  try {
    const paciente = new Paciente(req.body);
    const nuevoPaciente = await paciente.save();
    return res.status(201).json(nuevoPaciente);
  } catch (error) {
    return handleError(res, error, 'Error al crear el paciente');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'paciente');

    const actualizado = await Paciente.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!actualizado) {
      throw createNotFoundError('Paciente', id);
    }

    return res.json(actualizado);
  } catch (error) {
    return handleError(res, error, 'Error al actualizar el paciente');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'paciente');

    const eliminado = await Paciente.findByIdAndDelete(id);
    if (!eliminado) {
      throw createNotFoundError('Paciente', id);
    }

    return res.status(204).send();
  } catch (error) {
    return handleError(res, error, 'Error al eliminar el paciente');
  }
});

module.exports = router;