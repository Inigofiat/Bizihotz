"use strict";

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const { connectDB } = require("../config/db");
const Paciente = require("../data/pacienteModel");
const Cita = require("../data/citaModel");
const HistorialPaciente = require("../data/historialPacienteModel");
const RegistroAntropometrico = require("../data/registroAntropometricoModel");
const PacienteUsuario = require("../data/pacienteUsuarioModelo");
const Usuario = require("../data/usuarioModel");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env")
});

const profesionalesSeedPath = path.resolve(__dirname, "..", "data", "profesionales.seed.json");
const profesionalesSeed = JSON.parse(fs.readFileSync(profesionalesSeedPath, "utf8"));

const nombres = ["Ane", "Jon", "Leire", "Mikel", "Naiara", "Iker", "Irati", "Asier", "Uxue", "Oier"];

const apellidos = [
  "Irigoyen",
  "Etxeberria",
  "Olaizola",
  "Aranburu",
  "Zubizarreta",
  "Goikoetxea",
  "Agirre",
  "Aldanondo",
  "Garmendia",
  "Sarasola"
];

const tiposConsulta = [
  "Valoracion inicial",
  "Seguimiento nutricional",
  "Control antropometrico",
  "Reeducacion alimentaria",
  "Consulta online"
];

const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const horaConsulta = (index) => {
  const baseHora = 9 + (index % 9);
  const minutos = index % 2 === 0 ? "00" : "30";
  return `${String(baseHora).padStart(2, "0")}:${minutos}`;
};

const round1 = (value) => Number(value.toFixed(1));
const calcularImc = (peso, altura) => round1(peso / (altura * altura));

const buildPacientes = (cantidad) => {
  const pacientes = [];
  for (let i = 0; i < cantidad; i += 1) {
    const nombre = nombres[i % nombres.length];
    const apellido = apellidos[i % apellidos.length];
    const year = 1970 + (i % 35);
    const month = i % 12;
    const day = (i % 28) + 1;
    pacientes.push({
      nombrePaciente: `${nombre} ${i + 1}`,
      apellidos: `${apellido} ${((i + 5) % 50) + 1}`,
      fechaNac: new Date(year, month, day),
      emailPaciente: `paciente${i + 1}@example.com`,
      telefono: `600${String(100000 + i).padStart(6, "0")}`
    });
  }
  return pacientes;
};

const seed = async () => {
  await connectDB();

  try {
    await Promise.all([
      PacienteUsuario.deleteMany({}),
      HistorialPaciente.deleteMany({}),
      RegistroAntropometrico.deleteMany({}),
      Cita.deleteMany({}),
      Paciente.deleteMany({}),
      Usuario.deleteMany({})
    ]);

    const usuariosSeed = profesionalesSeed.map((profesional) => {
      return {
        nombreUsuario: profesional.nombreUsuario,
        email: profesional.email.toLowerCase().trim(),
        telefono: profesional.telefono ?? "",
        rol: profesional.rol ?? "profesional",
        foto: profesional.foto ?? "",
        passwordHash: bcrypt.hashSync("Bizihotz2025!", 12),
        activo: profesional.activo ?? true,
        debeActualizarPassword: false,
        ultimoCambioPassword: null
      };
    });

    const usuariosInsertados = await Usuario.insertMany(usuariosSeed);
    const profesionalIds = usuariosInsertados.map((usuario) => usuario._id);

    const totalRegistros = 100;
    const pacientesSeed = buildPacientes(totalRegistros);
    const pacientesInsertados = await Paciente.insertMany(pacientesSeed);

    const hoy = new Date();
    const citasSeed = pacientesInsertados.map((pacienteDoc, index) => {
      const profesionalId = profesionalIds[index % profesionalIds.length];
      return {
        fechaCita: addDays(hoy, (index % 40) - 20),
        hora: horaConsulta(index),
        tipoConsulta: tiposConsulta[index % tiposConsulta.length],
        notas: `Seguimiento del paciente ${pacienteDoc.nombrePaciente}.`,
        atendida: index % 3 === 0,
        idUsuario: profesionalId,
        idPaciente: pacienteDoc._id
      };
    });

    const citasInsertadas = await Cita.insertMany(citasSeed);

    const historialesSeed = citasInsertadas.map((citaDoc, index) => ({
      observaciones: `Resumen consulta ${index + 1}: se revisan objetivos y adherencia.`,
      fechaActualizacion: addDays(hoy, -1 * (index % 15)),
      idPaciente: citaDoc.idPaciente,
      idUsuario: citaDoc.idUsuario,
      idCita: citaDoc._id
    }));

    await HistorialPaciente.insertMany(historialesSeed);

    const registrosSeed = pacientesInsertados.map((pacienteDoc, index) => {
      const altura = round1(1.55 + (index % 25) * 0.01);
      const peso = round1(55 + (index % 30) + (index % 2 === 0 ? 0.4 : 0.7));
      const grasa = round1(20 + (index % 12) + (index % 2 === 0 ? 0.5 : 0.2));
      const profesionalId = profesionalIds[index % profesionalIds.length];
      return {
        fechaMedicion: addDays(hoy, -1 * (index % 60)),
        peso,
        altura,
        imc: calcularImc(peso, altura),
        grasaCorporal: grasa,
        observaciones: `Registro generado en consulta ${index + 1}.`,
        idPaciente: pacienteDoc._id,
        idUsuario: profesionalId
      };
    });

    await RegistroAntropometrico.insertMany(registrosSeed);

    const pacienteUsuarioSeed = pacientesInsertados.map((pacienteDoc, index) => ({
      idUsuario: profesionalIds[index % profesionalIds.length],
      idPaciente: pacienteDoc._id
    }));

    await PacienteUsuario.insertMany(pacienteUsuarioSeed);

    console.log("Seed completado correctamente con 100 registros por coleccion.");
    console.log("Las contrasenas de los profesionales son fijas. Administra su entrega por un canal seguro.");
  } catch (error) {
    console.error("Error cargando datos de ejemplo:", error);
  } finally {
    await mongoose.connection.close();
  }
};

seed();
