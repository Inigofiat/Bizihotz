const mongoose = require('mongoose');

const {
  ESTADOS_VALIDOS,
  coerceEstado,
  deriveEstadoDesdeAtendida,
  ESTADO_ERROR_MESSAGE
} = require('../utils/estadoCita');

const citaModelo = new mongoose.Schema({
  fechaCita: { type: Date, required: true },

  hora: {
    type: String,
    required: true,
    validate: {
      validator: function (value) {
        const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!regex.test(value)) return false;

        const [hora, minuto] = value.split(':').map(Number);
        const totalMinutos = hora * 60 + minuto;

        const desde = 9 * 60;   
        const hasta = 21 * 60;  

        return totalMinutos >= desde && totalMinutos <= hasta;
      },
      message: props => `${props.value} no está entre las 09:00 y 21:00 (HH:mm)`
    }
  },

  tipoConsulta: { type: String, required: true },
  notas: { type: String, required: false },
  estado: {
    type: String,
    enum: ESTADOS_VALIDOS,
    default: 'Pendiente',
    required: true,
    trim: true
  },
  atendida: { type: Boolean, default: false },
  idUsuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  idPaciente: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true }
}, { timestamps: true });

citaModelo.pre('validate', function (next) {
  const doc = this;

  if (doc.isModified('estado')) {
    const normalizado = coerceEstado(doc.estado);
    if (!normalizado) {
      doc.invalidate('estado', ESTADO_ERROR_MESSAGE);
      return next(new mongoose.Error.ValidationError(doc));
    }

    doc.estado = normalizado.estado;
    doc.atendida = normalizado.atendida;
  } else if (doc.isModified('atendida')) {
    doc.estado = deriveEstadoDesdeAtendida(Boolean(doc.atendida), doc.estado);
  } else if (!doc.estado) {
    doc.estado = deriveEstadoDesdeAtendida(Boolean(doc.atendida), doc.estado);
  }

  if (typeof doc.atendida === 'undefined' || doc.atendida === null) {
    doc.atendida = false;
  }

  next();
});

citaModelo.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (_, ret) {
    ret.idCita = ret._id;
    delete ret._id;
  }
});

module.exports = mongoose.model('Cita', citaModelo, 'Cita');
