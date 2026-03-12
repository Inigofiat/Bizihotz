"use strict";

const { ROLES } = require("../constants/roles");

const normalize = (value = "") => value.toString().trim().toLowerCase();

const resolveRolSistema = (req) => {
  if (!req || !req.user) return null;
  return req.user.rolSistema || req.user.perfil || req.user.role || null;
};

/**
 * Middleware de control de acceso por rol.
 * Se comporta de forma permisiva con usuarios antiguos sin `rolSistema`,
 * asumiendo el perfil por defecto "Profesional del centro".
 */
const permitirRoles = (...rolesPermitidos) => {
  const normalizedAllowed = rolesPermitidos.map(normalize);

  return (req, res, next) => {
    if (!req?.user) {
      return res.status(401).json({ mensaje: "Autenticacion requerida." });
    }

    const rolSistema = resolveRolSistema(req) || ROLES.PROFESIONAL;
    const current = normalize(rolSistema);

    if (!normalizedAllowed.length || normalizedAllowed.includes(current)) {
      return next();
    }

    return res.status(403).json({
      mensaje: "No tienes permisos para realizar esta accion.",
      rolActual: rolSistema
    });
  };
};

module.exports = {
  permitirRoles,
  ROLES
};
