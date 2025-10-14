const mongoose = require('mongoose');

const pacienteModelo = new mongoose.Schema({
  nombrePaciente: { type: String, required: true },
  apellidos: { type: String, required: true },
  fechaNac: { type: Date, required: true },  
  emailPaciente: { type: String, required: true, unique: true },
  telefono: { type: String, required: true } 
}, { timestamps: true });

pacienteModelo.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (_, ret) {
    ret.idPaciente = ret._id;
    delete ret._id;
  }
});

module.exports = mongoose.model('Paciente', pacienteModelo);
