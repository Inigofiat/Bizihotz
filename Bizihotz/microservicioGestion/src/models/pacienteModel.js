const mongoose = require('mongoose');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s\-().]{6,20}$/;

const pacienteModelo = new mongoose.Schema(
  {
    nombrePaciente: { type: String, required: true, trim: true },
    apellidos: { type: String, required: true, trim: true },
    fechaNac: { type: Date, required: true },
    estado: {
      type: String,
      enum: ['activo', 'baja'],
      default: 'activo',
      index: true
    },
    fechaBaja: { type: Date, default: null },
    motivoBaja: { type: String, trim: true, maxlength: 500, default: '' },
    bajaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    emailPaciente: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, 'Email de paciente no valido']
    },
    telefono: {
      type: String,
      required: true,
      trim: true,
      match: [PHONE_REGEX, 'Telefono de paciente no valido']
    }
  },
  { timestamps: true }
);

pacienteModelo.index({ nombrePaciente: 'text', apellidos: 'text', emailPaciente: 'text', telefono: 'text' });

pacienteModelo.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (_, ret) {
    ret.idPaciente = ret._id;
    delete ret._id;
  }
});

module.exports = mongoose.model('Paciente', pacienteModelo);
