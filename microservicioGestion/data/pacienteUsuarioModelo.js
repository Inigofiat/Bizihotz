const mongoose = require('mongoose');

const pacienteUsuarioModelo= new mongoose.Schema({
  idUsuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  idPaciente: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true }
}, { timestamps: true });

pacienteUsuarioModelo.index({ idUsuario: 1, idPaciente: 1 }, { unique: true });

pacienteUsuarioModelo.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (_, ret) {
    ret.idPacienteUsuario = ret._id;
    delete ret._id;
  }
});

module.exports = mongoose.model('PacienteUsuario', pacienteUsuarioModelo);
