"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const Usuario = require("../models/usuarioModel");
const { signToken } = require("../utils/jwt");

const router = express.Router();

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.post("/login", async (req, res, next) => {
  try {
    const { email, password, identificador } = req.body ?? {};
    const loginInput = (identificador ?? email ?? "").toString().trim();

    if (!loginInput || !password) {
      return res
        .status(400)
        .json({ mensaje: "Email o nombre de usuario y contrasena son obligatorios." });
    }

    const normalizedEmail = loginInput.toLowerCase();
    const query = loginInput.includes("@")
      ? { email: normalizedEmail }
      : {
          $or: [
            { nombreUsuario: new RegExp(`^${escapeRegExp(loginInput)}$`, "i") },
            { email: normalizedEmail }
          ]
        };

    const usuario = await Usuario.findOne({ ...query, activo: true });

    if (!usuario) {
      return res.status(401).json({ mensaje: "Credenciales invalidas." });
    }

    const valido = await bcrypt.compare(password, usuario.contraseniaHash || "");

    if (!valido) {
      return res.status(401).json({ mensaje: "Credenciales invalidas." });
    }

    const ahora = new Date();
    // Persistimos el último acceso de forma explícita para evitar que se pierda.
    await Usuario.updateOne({ _id: usuario._id }, { $set: { ultimoAcceso: ahora } }).catch(() => {});
    usuario.ultimoAcceso = ahora;

    const usuarioPlano = usuario.toJSON();
    const authPayload = {
      idUsuario: usuarioPlano.idUsuario,
      nombreUsuario: usuarioPlano.nombreUsuario,
      email: usuarioPlano.email,
      rol: usuarioPlano.rol,
      rolSistema: usuarioPlano.rolSistema || "Profesional del centro"
    };
    const token = signToken(authPayload);

    return res.json({
      mensaje: "Inicio de sesion correcto.",
      token,
      usuario: {
        ...authPayload,
        nombre: usuarioPlano.nombre ?? "",
        apellidos: usuarioPlano.apellidos ?? "",
        telefono: usuarioPlano.telefono ?? "",
        foto: usuarioPlano.foto ?? "",
        debeActualizarCont: usuarioPlano.debeActualizarCont ?? false,
        ultimoCambioCont: usuarioPlano.ultimoCambioCont ?? null,
        ultimoAcceso: usuarioPlano.ultimoAcceso ?? null
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", (_req, res) => {
  return res.json({ mensaje: "Sesion cerrada correctamente." });
});

router.post("/cambiar-password", async (req, res, next) => {
  try {
    const { email, passwordActual, passwordNueva } = req.body ?? {};

    if (!email || !passwordActual || !passwordNueva) {
      return res
        .status(400)
        .json({ mensaje: "Email, contrasena actual y nueva son obligatorios." });
    }

    if (passwordNueva.length < 8) {
      return res
        .status(400)
        .json({ mensaje: "La nueva contrasena debe tener al menos 8 caracteres." });
    }

    const usuario = await Usuario.findOne({ email: email.toLowerCase().trim(), activo: true });

    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    const valido = await bcrypt.compare(passwordActual, usuario.contraseniaHash || "");

    if (!valido) {
      return res.status(401).json({ mensaje: "La contrasena actual es incorrecta." });
    }

    const esIgualAnterior = await bcrypt.compare(passwordNueva, usuario.contraseniaHash || "");

    if (esIgualAnterior) {
      return res
        .status(400)
        .json({ mensaje: "La nueva contrasena debe ser diferente a la actual." });
    }

    usuario.contraseniaHash = await bcrypt.hash(passwordNueva, 12);
    usuario.debeActualizarCont = false;
    usuario.ultimoCambioCont = new Date();

    await usuario.save();

    return res.json({ mensaje: "Contrasena actualizada correctamente." });
  } catch (error) {
    return next(error);
  }
});

router.post("/confirmar-password", async (req, res, next) => {
  try {
    const { email, passwordActual } = req.body ?? {};

    if (!email || !passwordActual) {
      return res.status(400).json({ mensaje: "Email y contrasena actual son obligatorios." });
    }

    const usuario = await Usuario.findOne({ email: email.toLowerCase().trim(), activo: true });

    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    const valido = await bcrypt.compare(passwordActual, usuario.contraseniaHash || "");

    if (!valido) {
      return res.status(401).json({ mensaje: "La contrasena actual es incorrecta." });
    }

    usuario.debeActualizarCont = false;
    usuario.ultimoCambioCont = new Date();
    await usuario.save();

    return res.json({ mensaje: "Contrasena confirmada. Puedes seguir usando la actual." });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
