"use strict";

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const Usuario = require("../models/usuarioModel");

const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "Bizihotz2025!";
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "administradorTFG";
const DEFAULT_RECEPCIONISTA_PASSWORD =
  process.env.DEFAULT_RECEPCIONISTA_PASSWORD || "recepcionistaTFG";
const PROFESIONALES_SEED = path.resolve(__dirname, "..", "models", "profesionales.seed.json");

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

const buildUsuarioDocs = (seedUsuarios, passwordHash) => {
  return seedUsuarios.map((profesional) => {
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
      rol: profesional.rol ?? "Nutricionista",
      rolSistema: profesional.rolSistema ?? "Profesional del centro",
      foto: profesional.foto ?? "",
      passwordHash: profesional.passwordHash ?? passwordHash,
      activo: profesional.activo ?? true,
      debeActualizarPassword: profesional.debeActualizarPassword ?? false,
      ultimoCambioPassword: profesional.ultimoCambioPassword ?? null
    };
  });
};

const ensureDefaultUsers = async () => {
  const usuariosExistentes = await Usuario.estimatedDocumentCount();
  if (usuariosExistentes > 0) {
    return false;
  }

  const contenidoSeed = fs.readFileSync(PROFESIONALES_SEED, "utf8");
  const profesionalesSeed = JSON.parse(contenidoSeed);
  const hashComun = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const hashAdmin = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
  const hashRecepcionista = await bcrypt.hash(DEFAULT_RECEPCIONISTA_PASSWORD, 12);
  const usuariosDocuments = buildUsuarioDocs(profesionalesSeed, hashComun);

  // Administrador inicial para poder gestionar profesionales desde el panel.
  usuariosDocuments.push({
    nombreUsuario: "admin",
    nombre: "Administrador",
    apellidos: "Bizihotz",
    email: "admin@bizihotz.com",
    telefono: "",
    rol: "Administrador",
    rolSistema: "Administrador",
    foto: "",
    passwordHash: hashAdmin,
    activo: true,
    debeActualizarPassword: false,
    ultimoCambioPassword: null
  });

  // Recepcionista inicial para la operativa de agenda y registro asistencial.
  usuariosDocuments.push({
    nombreUsuario: "recep",
    nombre: "Recepcionista",
    apellidos: "Bizihotz",
    email: "recepcionista@bizihotz.com",
    telefono: "",
    rol: "Recepcionista",
    rolSistema: "Recepcionista",
    foto: "",
    passwordHash: hashRecepcionista,
    activo: true,
    debeActualizarPassword: false,
    ultimoCambioPassword: null
  });

  await Usuario.insertMany(usuariosDocuments);
  return true;
};

module.exports = { ensureDefaultUsers };
