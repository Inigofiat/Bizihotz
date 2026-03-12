"use strict";

/**
 * Catálogo centralizado de roles del sistema.
 * Mantener los textos estables: se usan en JWT y comprobaciones de permisos.
 */
const ROLES = Object.freeze({
  ADMIN: "Administrador",
  RECEPCIONISTA: "Recepcionista",
  PROFESIONAL: "Profesional del centro"
});

module.exports = { ROLES };
