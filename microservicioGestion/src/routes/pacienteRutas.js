const express = require('express');
const Paciente = require('../models/pacienteModel');
const Cita = require('../models/citaModel');
const HistorialPaciente = require('../models/historialPacienteModel');
const RegistroAntropometrico = require('../models/registroAntropometricoModel');
const { ensureValidObjectId } = require('../utils/validators');
const { createNotFoundError } = require('../utils/httpErrors');

const router = express.Router();

const parseBoolean = (value, defaultValue = false) => {
  if (typeof value === 'undefined' || value === null) {
    return defaultValue;
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'si'].includes(normalized);
  }
  return defaultValue;
};
const handleError = (res, error, defaultMessage) => {
  if (error?.name === 'ValidationError') {
    return res.status(400).json({ mensaje: error.message });
  }

  if (error?.code === 11000) {
    return res.status(409).json({ mensaje: 'Ya existe un paciente con ese email.' });
  }

  const status = error?.status || 500;
  const mensaje = error?.message || defaultMessage;
  return res.status(status).json({ mensaje });
};

const sanitizePacientePayload = (payload = {}) => {
  const sanitized = {};
  if (payload.nombrePaciente !== undefined) sanitized.nombrePaciente = payload.nombrePaciente;
  if (payload.apellidos !== undefined) sanitized.apellidos = payload.apellidos;
  if (payload.fechaNac !== undefined) sanitized.fechaNac = payload.fechaNac;
  if (payload.emailPaciente !== undefined) sanitized.emailPaciente = payload.emailPaciente;
  if (payload.telefono !== undefined) sanitized.telefono = payload.telefono;
  return sanitized;
};

const normalizeText = (value = '') => {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
};

const buildSafeRegex = (value = '') => {
  const escaped = normalizeText(value)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .trim();
  if (!escaped) {
    return null;
  }
  return new RegExp(escaped, 'i');
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
};

const buildSortCriteria = (value) => {
  if (!value || typeof value !== 'string') {
    return { createdAt: -1 };
  }

  const [field, direction] = value.split(':').map((part) => part.trim());
  if (!field) {
    return { createdAt: -1 };
  }
  return { [field]: direction === 'asc' ? 1 : -1 };
};

router.get('/', async (req, res) => {
  try {
    const { buscar, page, limit, sort, estado } = req.query;
    const filtro = {};

    // Por defecto incluimos pacientes en standby/baja; solo se excluyen si el cliente lo pide.
    const includeInactive = (Object.prototype.hasOwnProperty.call(req.query, 'incluirBaja')
      || Object.prototype.hasOwnProperty.call(req.query, 'incluirInactivos'))
      ? parseBoolean(req.query.incluirBaja || req.query.incluirInactivos, false)
      : true;
    const estadoNormalized = typeof estado === 'string' ? estado.trim().toLowerCase() : '';
    const isStandbyFilter = estadoNormalized === 'standby' || estadoNormalized === 'baja';
    if (estadoNormalized === 'activo' || isStandbyFilter) {
      if (estadoNormalized === 'activo') {
        filtro.$or = [{ estado: 'activo' }, { estado: { $exists: false } }];
      } else {
        // Aceptamos "baja" por compatibilidad, pero usamos "standby" como estado de inactividad.
        filtro.estado = { $in: ['standby', 'baja'] };
      }
    } else if (!includeInactive) {
      filtro.$or = [{ estado: 'activo' }, { estado: { $exists: false } }];
    }

    if (buscar) {
      const rawSearch = String(buscar).trim();
      if (rawSearch) {
        const normalized = normalizeText(rawSearch);
        const terms = normalized.split(/\s+/).filter(Boolean);
        const searchHasEmail = rawSearch.includes('@');
        const looksLikePhone = /^[+\d][\d\s\-().]*$/.test(rawSearch);
        const telefonoSoloDigitos = looksLikePhone ? rawSearch.replace(/\D/g, '') : '';

        const condiciones = [];

        if (searchHasEmail) {
          const emailEscaped = rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          condiciones.push({
            emailPaciente: new RegExp(`^${emailEscaped}$`, 'i')
          });
        } else {
          const baseRegex = buildSafeRegex(rawSearch);
          if (baseRegex) {
            condiciones.push({ nombrePaciente: baseRegex });
            condiciones.push({ apellidos: baseRegex });
            condiciones.push({ emailPaciente: baseRegex });
            if (!telefonoSoloDigitos) {
              condiciones.push({ telefono: baseRegex });
            }
          }

          if (terms.length >= 2) {
            for (let i = 0; i < terms.length; i += 1) {
              const nombrePartes = terms.slice(0, i + 1).join(' ');
              const apellidoPartes = terms.slice(i + 1).join(' ');
              if (!apellidoPartes) {
                continue;
              }
              condiciones.push({
                $and: [
                  { nombrePaciente: buildSafeRegex(nombrePartes) },
                  { apellidos: buildSafeRegex(apellidoPartes) }
                ]
              });
              condiciones.push({
                $and: [
                  { nombrePaciente: buildSafeRegex(apellidoPartes) },
                  { apellidos: buildSafeRegex(nombrePartes) }
                ]
              });
            }
          }
        }

        if (telefonoSoloDigitos) {
          condiciones.push({
            telefono: new RegExp(`^${telefonoSoloDigitos}`, 'i')
          });
        }

        if (condiciones.length) {
          filtro.$or = condiciones;
        }
      }
    }

    const pageNumber = parsePositiveInt(page, null);
    const pageSize = parsePositiveInt(limit, null);
    const criteria = buildSortCriteria(sort);

    if (pageNumber || pageSize) {
      const currentPage = pageNumber || 1;
      const size = pageSize || 20;
      const skip = (currentPage - 1) * size;

      const [total, items] = await Promise.all([
        Paciente.countDocuments(filtro),
        Paciente.find(filtro).sort(criteria).skip(skip).limit(size)
      ]);

      return res.json({
        items,
        total,
        page: currentPage,
        pageSize: size,
        pages: Math.max(1, Math.ceil(total / size))
      });
    }

    const pacientes = await Paciente.find(filtro).sort(criteria);
    return res.json(pacientes);
  } catch (error) {
    return handleError(res, error, 'Error al obtener los pacientes');
  }
});

router.get('/:id/resumen', async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'paciente');

    const paciente = await Paciente.findById(id).lean({ virtuals: true });
    if (!paciente) {
      throw createNotFoundError('Paciente', id);
    }

    const ahora = new Date();

    const todasLasCitasPromise = Cita.find({ idPaciente: id })
      .populate({ path: 'idUsuario', select: 'nombre nombreUsuario apellidos' })
      .sort({ fechaCita: -1, hora: -1 })
      .lean({ virtuals: true });

    const historialPromise = HistorialPaciente.find({ idPaciente: id })
      .populate({ path: 'idUsuario', select: 'nombre nombreUsuario apellidos' })
      .populate({ path: 'idCita', select: 'fechaCita hora tipoConsulta' })
      .sort({ fechaActualizacion: -1 })
      .limit(20)
      .lean();

    const registrosPromise = RegistroAntropometrico.find({ idPaciente: id })
      .populate({ path: 'idUsuario', select: 'nombre nombreUsuario apellidos' })
      .sort({ fechaMedicion: -1 })
      .lean();

    const [todasLasCitasRaw, historialRaw, registrosRaw] = await Promise.all([
      todasLasCitasPromise,
      historialPromise,
      registrosPromise
    ]);

    const mapProfesionalNombre = (registro) => {
      const ref = registro?.idUsuario;
      if (!ref) return '';
      const partes = [ref.nombre, ref.apellidos].filter(Boolean).join(' ').trim();
      if (partes) return partes;
      return ref.nombreUsuario || '';
    };

    const normalizeCita = (cita) => ({
      idCita: cita.idCita || cita._id?.toString?.() || null,
      fechaCita: cita.fechaCita,
      hora: cita.hora,
      tipoConsulta: cita.tipoConsulta || '',
      estado: cita.estado,
      profesional: mapProfesionalNombre(cita),
      notas: cita.notas || '',
      atendida: Boolean(cita.atendida)
    });

    const proximasCitas = todasLasCitasRaw
      .filter((cita) => {
        const fecha = cita.fechaCita ? new Date(cita.fechaCita) : null;
        return fecha && fecha >= ahora;
      })
      .sort((a, b) => new Date(a.fechaCita) - new Date(b.fechaCita))
      .slice(0, 5)
      .map(normalizeCita);

    const citasRecientes = todasLasCitasRaw
      .filter((cita) => {
        const fecha = cita.fechaCita ? new Date(cita.fechaCita) : null;
        return fecha && fecha < ahora;
      })
      .sort((a, b) => new Date(b.fechaCita) - new Date(a.fechaCita))
      .slice(0, 5)
      .map(normalizeCita);

    const citasTodas = todasLasCitasRaw.map(normalizeCita);

    const historial = historialRaw.map((entrada) => ({
      idHistorial: entrada._id?.toString?.() || null,
      fechaActualizacion: entrada.fechaActualizacion,
      observaciones: entrada.observaciones,
      profesional: mapProfesionalNombre(entrada),
      cita: entrada.idCita
        ? {
            fechaCita: entrada.idCita.fechaCita,
            hora: entrada.idCita.hora,
            tipoConsulta: entrada.idCita.tipoConsulta || ''
          }
        : null
    }));

    const registros = registrosRaw.map((registro) => ({
      idMedicion: registro._id?.toString?.() || null,
      fechaMedicion: registro.fechaMedicion,
      peso: registro.peso,
      altura: registro.altura,
      imc: registro.imc,
      grasaCorporal: registro.grasaCorporal,
      observaciones: registro.observaciones || '',
      profesional: mapProfesionalNombre(registro)
    }));

    let resumenAntropometrico = null;
    if (registros.length) {
      const ultima = registros[0];
      const primera = registros[registros.length - 1];

      const treintaDiasAtras = new Date(ahora);
      treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
      const registroHace30Dias = registrosRaw.find((registro) => {
        const fecha = registro.fechaMedicion ? new Date(registro.fechaMedicion) : null;
        return fecha && fecha <= treintaDiasAtras;
      });

      const variacion30Dias = registroHace30Dias
        ? Number.parseFloat((ultima.peso - registroHace30Dias.peso).toFixed(2))
        : null;
      const variacionTotal = primera
        ? Number.parseFloat((ultima.peso - primera.peso).toFixed(2))
        : null;

      resumenAntropometrico = {
        totalRegistros: registros.length,
        fechaUltimaMedicion: ultima.fechaMedicion,
        pesoActual: ultima.peso,
        altura: ultima.altura,
        imcActual: ultima.imc,
        grasaCorporal: ultima.grasaCorporal,
        variacion30Dias,
        variacionTotal
      };
    }

    return res.json({
      paciente,
      proximasCitas,
      citasRecientes,
      historial,
      citas: citasTodas,
      registrosAntropometricos: {
        resumen: resumenAntropometrico,
        registros
      }
    });
  } catch (error) {
    return handleError(res, error, 'Error al obtener el resumen del paciente');
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
    const payload = sanitizePacientePayload(req.body);
    const paciente = new Paciente(payload);
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

    const payload = sanitizePacientePayload(req.body);

    const actualizado = await Paciente.findByIdAndUpdate(id, payload, {
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

router.post('/:id/baja', setPacienteStandby);
// Alias más semántico para pasar a standby sin eliminar.
router.post('/:id/standby', setPacienteStandby);

// Helper compartido para poner a un paciente en standby (sin eliminarlo).
async function setPacienteStandby(req, res) {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'paciente');

    const paciente = await Paciente.findById(id);
    if (!paciente) {
      throw createNotFoundError('Paciente', id);
    }

    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
    const bajaPor = req.body?.bajaPor || null;

    if (paciente.estado === 'standby' || paciente.estado === 'baja') {
      return res.json({
        mensaje: 'El paciente ya estaba en standby.',
        paciente
      });
    }

    paciente.estado = 'standby';
    paciente.fechaBaja = new Date();
    paciente.motivoBaja = motivo;
    paciente.bajaPor = bajaPor;
    await paciente.save();

    return res.json({
      mensaje: 'Paciente pasado a standby correctamente.',
      paciente
    });
  } catch (error) {
    return handleError(res, error, 'Error al poner al paciente en standby');
  }
}

router.post('/:id/reactivar', async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'paciente');

    const paciente = await Paciente.findById(id);
    if (!paciente) {
      throw createNotFoundError('Paciente', id);
    }

    if (paciente.estado === 'activo') {
      return res.json({
        mensaje: 'El paciente ya estaba activo.',
        paciente
      });
    }

    paciente.estado = 'activo';
    paciente.fechaBaja = null;
    paciente.motivoBaja = '';
    paciente.bajaPor = null;
    await paciente.save();

    return res.json({
      mensaje: 'Paciente reactivado correctamente.',
      paciente
    });
  } catch (error) {
    return handleError(res, error, 'Error al reactivar al paciente');
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
