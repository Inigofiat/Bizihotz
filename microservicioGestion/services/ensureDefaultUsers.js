"use strict";

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const Usuario = require("../data/usuarioModel");

const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "Bizihotz2025!";
const PROFESIONALES_SEED = path.resolve(__dirname, "..", "data", "profesionales.seed.json");

const buildUsuarioDocs = (seedUsuarios, passwordHash) => {
  return seedUsuarios.map((profesional) => ({
    nombreUsuario: profesional.nombreUsuario,
    email: profesional.email.toLowerCase().trim(),
    telefono: profesional.telefono ?? "",
    rol: profesional.rol ?? "profesional",
    foto: profesional.foto ?? "",
    passwordHash: profesional.passwordHash ?? passwordHash,
    activo: profesional.activo ?? true,
    debeActualizarPassword: profesional.debeActualizarPassword ?? false,
    ultimoCambioPassword: profesional.ultimoCambioPassword ?? null
  }));
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
