"use strict";

const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env")
});

const { connectDB } = require("../config/db");
const Cita = require("../data/citaModel");
const Usuario = require("../data/usuarioModel");

const run = async () => {
  const fechaArg = process.argv[2];
  const usuarioSlug = process.argv[3] || "a";

  if (!fechaArg) {
    console.error("Uso: node scripts/findCitasPorFecha.js <YYYY-MM-DD> [usuario]");
    process.exit(1);
  }

  const fecha = new Date(`${fechaArg}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) {
    console.error("Fecha invalida:", fechaArg);
    process.exit(1);
  }

  const diaSiguiente = new Date(fecha);
  diaSiguiente.setUTCDate(diaSiguiente.getUTCDate() + 1);

  try {
    await connectDB();
    const usuario = await Usuario.findOne({
      $or: [
        { nombreUsuario: usuarioSlug },
        { email: usuarioSlug }
      ]
    }).lean();

    if (!usuario) {
      console.error("No se encontro usuario con slug:", usuarioSlug);
      return;
    }

    const citas = await Cita.find({
      idUsuario: usuario._id,
      fechaCita: { $gte: fecha, $lt: diaSiguiente }
    })
      .sort({ fechaCita: 1, hora: 1 })
      .lean();

    console.log(`Citas para ${usuarioSlug} en ${fechaArg}: ${citas.length}`);
    citas.forEach((cita, index) => {
      console.log(
        `#${index + 1}`,
        new Date(cita.fechaCita).toISOString(),
        cita.hora,
        cita.tipoConsulta,
        cita._id.toString()
      );
    });
  } catch (error) {
    console.error("Error consultando citas:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
