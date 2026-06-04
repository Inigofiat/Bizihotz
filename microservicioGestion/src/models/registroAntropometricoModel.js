const mongoose = require('mongoose');

const registroModelo = new mongoose.Schema({
  fechaMedicion: { type: Date, default: Date.now, required: true },
  peso: { type: Number, required: true },
  altura: { type: Number, required: true },
  imc: { type: Number, required: true },
  grasaCorporal: { type: Number, required: false },
  observaciones: { type: String, required: false },
  idPaciente: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true },
  idUsuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true }
}, { timestamps: true });

registroModelo.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (_, ret) {
    ret.idMedicion = ret._id;
    delete ret._id;
  }
});

module.exports = mongoose.model('RegistroAntropometrico', registroModelo, 'RegistroAntropometrico');
