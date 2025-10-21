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

const nombres = [
  "Ane",
  "Jon",
  "Leire",
  "Mikel",
  "Naiara",
  "Iker",
  "Irati",
  "Asier",
  "Uxue",
  "Oier",
  "Amaia",
  "Gaizka",
  "Itziar",
  "Unai",
  "Maddi",
  "Aritz",
  "Maialen",
  "Luken",
  "Naroa",
  "Ander",
  "June",
  "Peio",
  "Iraia",
  "Kerman",
  "Haizea",
  "Ekhi",
  "Xabat",
  "Iholdi",
  "Markel",
  "Lorea"
];

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
  "Sarasola",
  "Altuna",
  "Zuazo",
  "Aramburu",
  "Lizarralde",
  "Mendizabal",
  "Arrieta",
  "Bengoetxea",
  "Altzaga",
  "Goenaga",
  "Lazkano",
  "Muguruza",
  "Lete",
  "Arruabarrena",
  "Iturriaga",
  "Larrarte",
  "Olabarria",
  "Urrutia",
  "Arrizabalaga",
  "Idigoras",
  "Etxaniz",
  "Manterola",
  "Erro",
  "Egia",
  "Araneta",
  "Otegi"
];

const tiposConsulta = [
  "Valoracion inicial",
  "Seguimiento nutricional",
  "Control antropometrico",
  "Reeducacion alimentaria",
  "Consulta online"
];

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

const createRandom = (seed = 123456) => {
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

const randomElement = (collection, rng = seededRandom) =>
  collection[Math.floor(rng() * collection.length)];

const shuffle = (input, rng = seededRandom) => {
  const result = [...input];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const round1 = (value) => Number(value.toFixed(1));
const calcularImc = (peso, altura) => round1(peso / (altura * altura));

const extractNombreApellidos = (profesional = {}) => {
  const nombreSeed = (profesional.nombre ?? "").trim();
  const apellidosSeed = (profesional.apellidos ?? "").trim();

  if (nombreSeed || apellidosSeed) {
    return { nombre: nombreSeed, apellidos: apellidosSeed };
  }

  const nombreUsuarioSeed = (profesional.nombreUsuario ?? "").trim();
  if (!nombreUsuarioSeed) {
    return { nombre: "", apellidos: "" };
  }

  const partes = nombreUsuarioSeed.split(/\s+/);
  if (partes.length === 1) {
    return { nombre: partes[0], apellidos: "" };
  }

  const [nombre, ...resto] = partes;
  return { nombre, apellidos: resto.join(" ") };
};

const normalizarEmailPart = (valor = "") =>
  valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const buildPacientes = (cantidad) => {
  const pacientes = [];
  for (let i = 0; i < cantidad; i += 1) {
    const nombre = randomElement(nombres);

    let apellido1 = randomElement(apellidos);
    let apellido2 = randomElement(apellidos);
    if (apellido2 === apellido1) {
      apellido2 = randomElement(apellidos);
    }

    const year = randomInt(1958, 2002);
    const month = randomInt(0, 11);
    const day = randomInt(1, 28);

    const emailBaseParts = [
      normalizarEmailPart(nombre),
      normalizarEmailPart(apellido1)
    ].filter(Boolean);
    const emailBase = emailBaseParts.join(".") || `paciente${i + 1}`;
    const emailPaciente = `${emailBase}${i}@example.com`;

    const telefonoSecuencia = (
      (i * 73 + randomInt(0, 9999999)) % 100000000
    ).toString();
    const telefono = `6${telefonoSecuencia.padStart(8, "0")}`;

    pacientes.push({
      nombrePaciente: nombre,
      apellidos: `${apellido1} ${apellido2}`,
      fechaNac: new Date(year, month, day),
      emailPaciente,
      telefono
    });
  }
  return pacientes;
};

const generarCitas = (
  pacientes,
  profesionalIds,
  opciones = {}
) => {
  const {
    diasPasado = 45,
    diasFuturo = 60,
    minCitasDia = 2,
    maxCitasDia = 6,
    probDiaLibre = 0.25,
    probDiaAltaCarga = 0.2,
    minimoAltaCarga = 10
  } = opciones;

  if (!pacientes.length || !profesionalIds.length) {
    return [];
  }

  const citas = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let indicePaciente = 0;

  profesionalIds.forEach((profesionalId, indiceProfesional) => {
    for (let offset = -diasPasado; offset <= diasFuturo; offset += 1) {
      const fechaBase = addDays(hoy, offset);
      fechaBase.setHours(0, 0, 0, 0);

      if (seededRandom() < probDiaLibre) {
        continue;
      }

      let totalDia = randomInt(minCitasDia, maxCitasDia);
      const esDiaEspecial = Math.abs(offset) % 12 === 0 || seededRandom() < probDiaAltaCarga;
      if (esDiaEspecial) {
        const incremento = randomInt(3, 6);
        totalDia = Math.min(
          Math.max(totalDia + incremento, minimoAltaCarga),
          horasDisponibles.length
        );
      }

      const horasDelDia = shuffle(horasDisponibles).slice(0, totalDia).sort();

      horasDelDia.forEach((hora) => {
        const paciente = pacientes[indicePaciente % pacientes.length];

        const atendida = offset < 0;

        const fechaCita = new Date(fechaBase);

        citas.push({
          fechaCita,
          hora,
          tipoConsulta: randomElement(tiposConsulta),
          notas: `Seguimiento del paciente ${paciente.nombrePaciente}.`,
          atendida,
          idUsuario: profesionalId,
          idPaciente: paciente._id
        });

        indicePaciente += 1;
      });
    }
  });

  return citas;
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
      const { nombre, apellidos } = extractNombreApellidos(profesional);
      const email = (profesional.email ?? "").toLowerCase().trim();
      const nombreUsuario =
        (profesional.nombreUsuario ?? "").trim() ||
        `${nombre} ${apellidos}`.trim() ||
        email.split("@")[0] ||
        "";

      return {
        nombreUsuario,
        nombre,
        apellidos,
        email,
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
    const citasSeed = generarCitas(pacientesInsertados, profesionalIds, {
      diasPasado: 60,
      diasFuturo: 75,
      minCitasDia: 2,
      maxCitasDia: 6,
      probDiaLibre: 0.2,
      probDiaAltaCarga: 0.25,
      minimoAltaCarga: 10
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

    const usuarioDemo = usuariosInsertados.find(
      (usuarioDoc) => usuarioDoc.nombreUsuario?.toLowerCase?.() === "a"
    );

    if (usuarioDemo && pacientesInsertados.length > 0) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const diasDemo = 210; // ~7 meses
      const fechaInicioDemo = addDays(hoy, -diasDemo);
      const fechaFinDemo = addDays(hoy, diasDemo);
      fechaInicioDemo.setHours(0, 0, 0, 0);
      fechaFinDemo.setHours(23, 59, 59, 999);

      await Cita.deleteMany({
        idUsuario: usuarioDemo._id,
        fechaCita: {
          $gte: fechaInicioDemo,
          $lte: fechaFinDemo
        }
      });

      const citasDemo = [];
      const totalPacientes = pacientesInsertados.length;
      let contadorPacientesDemo = 0;

      for (let offset = -diasDemo; offset <= diasDemo; offset += 1) {
        const fecha = addDays(hoy, offset);
        fecha.setHours(0, 0, 0, 0);

        let citasDia = randomInt(2, 6);
        const esDiaEspecial = Math.abs(offset) % 12 === 0 || seededRandom() < 0.25;
        if (esDiaEspecial) {
          const incremento = randomInt(3, 6);
          citasDia = Math.min(Math.max(citasDia + incremento, 10), horasDisponibles.length);
        }
        const horasDelDia = shuffle(horasDisponibles).slice(0, citasDia).sort();

        horasDelDia.forEach((hora) => {
          const pacienteDemo =
            pacientesInsertados[contadorPacientesDemo % totalPacientes];

          citasDemo.push({
            fechaCita: new Date(fecha),
            hora,
            tipoConsulta: randomElement(tiposConsulta),
            notas: `Consulta demo con ${pacienteDemo.nombrePaciente} ${pacienteDemo.apellidos}.`,
            atendida: offset < 0,
            idUsuario: usuarioDemo._id,
            idPaciente: pacienteDemo._id
          });

          contadorPacientesDemo += 1;
        });
      }

      await Cita.insertMany(citasDemo);
      console.log(
        `Se generaron ${citasDemo.length} citas demo para el usuario '${usuarioDemo.nombreUsuario}' cubriendo aproximadamente ${diasDemo * 2 + 1} dias.`
      );
    } else {
      console.warn(
        "No se generaron citas demo porque falta el usuario 'a' o no hay pacientes disponibles."
      );
    }

    console.log("Seed completado correctamente con 100 registros por coleccion.");
    console.log("Las contrasenas de los profesionales son fijas. Administra su entrega por un canal seguro.");
  } catch (error) {
    console.error("Error cargando datos de ejemplo:", error);
  } finally {
    await mongoose.connection.close();
  }
};

seed();





