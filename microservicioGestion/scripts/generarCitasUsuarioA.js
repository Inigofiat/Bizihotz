"use strict";

const path = require("path");
const mongoose = require("mongoose");

const { connectDB } = require("../config/db");
const Usuario = require("../data/usuarioModel");
const Paciente = require("../data/pacienteModel");
const Cita = require("../data/citaModel");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env")
});

const inicioDeDia = (fecha) => {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
};

const finDeDia = (fecha) => {
  const copia = new Date(fecha);
  copia.setHours(23, 59, 59, 999);
  return copia;
};

const horasDisponibles = [
  "09:00",
  "09:45",
  "10:30",
  "11:15",
  "12:00",
  "12:45",
  "13:30",
  "15:00",
  "15:45",
  "16:30",
  "17:15",
  "18:00",
  "18:45",
  "19:30"
];

const tiposConsulta = [
  "Seguimiento nutricional",
  "Consulta de control",
  "Revision de habitos"
];

const createRandom = (seed = 987654) => {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
};

const seededRandom = createRandom(20251021);

const randomInt = (min, max, rng = seededRandom) =>
  min + Math.floor(rng() * (max - min + 1));

const shuffle = (input, rng = seededRandom) => {
  const copia = [...input];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

const generarCitas = async () => {
  await connectDB();

  try {
    const usuario = await Usuario.findOne({ nombreUsuario: "a" });

    if (!usuario) {
      throw new Error("No se encontro el usuario con nombreUsuario 'a'.");
    }

    const paciente = await Paciente.findOne();

    if (!paciente) {
      throw new Error("No hay pacientes disponibles en la base de datos.");
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const diasGenerados = [];

    for (let offset = -15; offset <= 15; offset += 1) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + offset);

      const inicio = inicioDeDia(fecha);
      const fin = finDeDia(fecha);

      await Cita.deleteMany({
        idUsuario: usuario._id,
        fechaCita: { $gte: inicio, $lte: fin }
      });

      if (seededRandom() < 0.2) {
        continue;
      }

      let totalDia = randomInt(2, 6);
      const esDiaEspecial = Math.abs(offset) % 12 === 0 || seededRandom() < 0.25;
      if (esDiaEspecial) {
        const incremento = randomInt(3, 6);
        totalDia = Math.min(Math.max(totalDia + incremento, 10), horasDisponibles.length);
      }
      const horasDia = shuffle(horasDisponibles).slice(0, totalDia).sort();

      const citasDia = horasDia.map((hora, index) => ({
        fechaCita: fecha,
        hora,
        tipoConsulta: tiposConsulta[index % tiposConsulta.length],
        notas: `Consulta generada automaticamente para ${fecha
          .toISOString()
          .slice(0, 10)} a las ${hora}.`,
        atendida: offset < 0,
        idUsuario: usuario._id,
        idPaciente: paciente._id
      }));

      await Cita.insertMany(citasDia);
      diasGenerados.push(fecha.toISOString().slice(0, 10));
    }

    console.log(
      `Citas generadas correctamente para el usuario '${usuario.nombreUsuario}' en ${diasGenerados.length} dias.`
    );
  } catch (error) {
    console.error("Error generando citas de ejemplo:", error.message);
  } finally {
    await mongoose.connection.close();
  }
};

generarCitas();
