"use strict";

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const Usuario = require("../models/usuarioModel");

const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "Bizihotz2025!";
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
      rol: profesional.rol ?? "profesional",
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
  const usuariosDocuments = buildUsuarioDocs(profesionalesSeed, hashComun);

  await Usuario.insertMany(usuariosDocuments);
  return true;
};

module.exports = { ensureDefaultUsers };
