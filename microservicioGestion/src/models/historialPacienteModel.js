const mongoose = require('mongoose');

const historialPacienteModelo = new mongoose.Schema({
  observaciones: { type: String, required: false },
  fechaActualizacion: { type: Date, default: Date.now, required: true },

  idPaciente: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true },
  idUsuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: false },
  idCita:     { type: mongoose.Schema.Types.ObjectId, ref: 'Cita', required: false } 
}, { timestamps: true });

historialPacienteModelo.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (_, ret) {
    ret.idHistorial = ret._id;
    delete ret._id;
  }
});

module.exports = mongoose.model('HistorialPaciente', historialPacienteModelo);
