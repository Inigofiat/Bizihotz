const express = require('express');
const Cita = require('../models/citaModel');
const { ensureValidObjectId } = require('../utils/validators');
const { createNotFoundError } = require('../utils/httpErrors');
const { ensureEstadoValido, deriveEstadoDesdeAtendida } = require('../utils/estadoCita');
const { permitirRoles, ROLES } = require('../middlewares/authorize');

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

const buildCitaPayload = (payload = {}) => {
  const prepared = { ...payload };

  if (Object.prototype.hasOwnProperty.call(prepared, 'estado')) {
    const { estado, atendida } = ensureEstadoValido(prepared.estado);
    prepared.estado = estado;
    prepared.atendida = atendida;
  } else if (Object.prototype.hasOwnProperty.call(prepared, 'atendida')) {
    const rawValue = prepared.atendida;
    const atendida = typeof rawValue === 'string'
      ? rawValue.trim().toLowerCase() === 'true'
      : Boolean(rawValue);
    prepared.atendida = atendida;
    prepared.estado = deriveEstadoDesdeAtendida(atendida, prepared.estado);
  }

  return prepared;
};

router.get('/', permitirRoles(ROLES.ADMIN, ROLES.PROFESIONAL, ROLES.RECEPCIONISTA), async (req, res) => {
  try {
    const { idPaciente, idUsuario, fechaDesde, fechaHasta, atendida } = req.query;
    const rolSolicitante = (req.user?.rolSistema || '').toLowerCase();
    const esRecepcionista = rolSolicitante === ROLES.RECEPCIONISTA.toLowerCase();
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

    const citas = await Cita.find(filtro)
      .populate({ path: "idPaciente", select: "nombrePaciente apellidos" })
      .populate({ path: "idUsuario", select: "nombre nombreUsuario apellidos rolSistema activo" })
      .sort({ fechaCita: 1, hora: 1 })
      .lean({ virtuals: true });

    const soloProfesionales = citas.filter((cita) => {
      const rol = (cita.idUsuario?.rolSistema || "").toLowerCase();
      const esRolValido =
        rol !== ROLES.ADMIN.toLowerCase() && rol !== ROLES.RECEPCIONISTA.toLowerCase();
      if (!esRolValido) {
        return false;
      }
      if (esRecepcionista && cita.idUsuario?.activo === false) {
        return false;
      }
      return true;
    });

    const transformadas = soloProfesionales.map((cita) => {
      const pacienteRef = cita.idPaciente;
      const usuarioRef = cita.idUsuario;

      const pacienteNombre =
        pacienteRef && pacienteRef.nombrePaciente
          ? pacienteRef.nombrePaciente
          : "";
      const pacienteApellidos =
        pacienteRef && pacienteRef.apellidos ? pacienteRef.apellidos : "";
      const profesionalNombre =
        usuarioRef && (usuarioRef.nombre || usuarioRef.nombreUsuario)
          ? [usuarioRef.nombre, usuarioRef.apellidos]
              .filter(Boolean)
              .join(" ")
              .trim() || usuarioRef.nombreUsuario
          : "";

      return {
        ...cita,
        paciente: [pacienteNombre, pacienteApellidos].filter(Boolean).join(" ").trim(),
        motivo: cita.tipoConsulta,
        profesional: profesionalNombre,
        estado: deriveEstadoDesdeAtendida(Boolean(cita.atendida), cita.estado)
      };
    });

    return res.json(transformadas);
  } catch (error) {
    return handleError(res, error, 'Error al obtener las citas');
  }
});

router.get('/:id', permitirRoles(ROLES.ADMIN, ROLES.PROFESIONAL, ROLES.RECEPCIONISTA), async (req, res) => {
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

router.post('/', permitirRoles(ROLES.ADMIN, ROLES.PROFESIONAL, ROLES.RECEPCIONISTA), async (req, res) => {
  try {
    const { idPaciente, idUsuario } = req.body;
    ensureValidObjectId(idPaciente, 'paciente');
    ensureValidObjectId(idUsuario, 'usuario');

    const payload = buildCitaPayload(req.body);
    const cita = new Cita(payload);    
    const nuevaCita = await cita.save();
    return res.status(201).json(nuevaCita);
  } catch (error) {
    return handleError(res, error, 'Error al crear la cita');
  }
});

router.put('/:id', permitirRoles(ROLES.ADMIN, ROLES.PROFESIONAL, ROLES.RECEPCIONISTA), async (req, res) => {
  try {
    // Verificar que la petición venga del Gateway en ambientes de producción.
    // Permitir accesos directos solo si la variable ALLOW_DIRECT está establecida a 'true' (desarrollo).
    const allowDirect =
      process.env.NODE_ENV !== 'production' ||
      String(process.env.ALLOW_DIRECT || '').toLowerCase() === 'true';
    if (!allowDirect) {
      const forwarded = req.headers['x-forwarded-by'] || req.headers['x-forwarded-host'];
      if (forwarded !== 'bizihotz-gateway') {
        const error = new Error('Acceso directo al microservicio no permitido. Use el API Gateway.');
        error.status = 403;
        throw error;
      }
    }
    const { id } = req.params;
    ensureValidObjectId(id, 'cita');

    if (req.body.idPaciente) {
      ensureValidObjectId(req.body.idPaciente, 'paciente');
    }
    if (req.body.idUsuario) {
      ensureValidObjectId(req.body.idUsuario, 'usuario');
    }

    const updates = buildCitaPayload(req.body);
    const actualizada = await Cita.findByIdAndUpdate(id, updates, {      
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

router.patch('/:id', permitirRoles(ROLES.ADMIN, ROLES.PROFESIONAL, ROLES.RECEPCIONISTA), async (req, res) => {
  try {
    const { id } = req.params;
    ensureValidObjectId(id, 'cita');

    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, 'notas')) {
      updates.notas = req.body.notas;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'estado')) {
      const { estado, atendida } = ensureEstadoValido(req.body.estado);
      updates.estado = estado;
      updates.atendida = atendida;
    }

    if (!Object.keys(updates).length) {
      const error = new Error('No se han proporcionado campos válidos para actualizar');
      error.status = 400;
      throw error;
    }

    const actualizada = await Cita.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!actualizada) {
      throw createNotFoundError('Cita', id);
    }

    return res.json(actualizada);
  } catch (error) {
    return handleError(res, error, 'Error al actualizar la cita');
  }
});
router.patch('/:id/atendida', permitirRoles(ROLES.ADMIN, ROLES.PROFESIONAL, ROLES.RECEPCIONISTA), async (req, res) => {
  try {
    const { id } = req.params;
    const { atendida } = req.body;

    if (typeof atendida !== 'boolean') {
      const error = new Error('El campo atendida debe ser booleano');
      error.status = 400;
      throw error;
    }

    ensureValidObjectId(id, 'cita');
    const estado = deriveEstadoDesdeAtendida(atendida);

    const actualizada = await Cita.findByIdAndUpdate(
      id,
      { atendida, estado },
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

router.delete('/:id', permitirRoles(ROLES.ADMIN, ROLES.PROFESIONAL, ROLES.RECEPCIONISTA), async (req, res) => {
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

