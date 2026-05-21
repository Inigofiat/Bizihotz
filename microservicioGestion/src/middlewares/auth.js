"use strict";

const { verifyToken } = require("../utils/jwt");
const { ROLES } = require("../constants/roles");

const EXCLUDED_PATHS = [
  { method: "GET", path: "/status" },
  { method: "GET", path: "/health" },
  { method: "GET", path: "/docs" },
  { method: "GET", path: "/docs/swagger.json" },
  { method: "POST", path: "/api/auth/login" }
];

const isExcluded = (req) =>
  EXCLUDED_PATHS.some(
    (rule) => rule.method === req.method && req.path.startsWith(rule.path)
  );

const parseBoolean = (value = "") =>
  ["1", "true", "yes", "on"].includes(value.toString().trim().toLowerCase());

const normalize = (value = "") => value.toString().trim().toLowerCase();
const ANONYMOUS_USER_ID = "000000000000000000000000";

const resolveAnonymousRole = () => {
  const configured = (process.env.ALLOW_ANONYMOUS_ROLE || "").trim();
  if (!configured) {
    return ROLES.ADMIN;
  }

  const matched = Object.values(ROLES).find(
    (role) => normalize(role) === normalize(configured)
  );

  return matched || ROLES.ADMIN;
};

const buildAnonymousUser = () => {
  const rolSistema = resolveAnonymousRole();
  return {
    idUsuario: ANONYMOUS_USER_ID,
    id: ANONYMOUS_USER_ID,
    nombreUsuario: "anon-dev",
    email: "anon@local",
    rol: rolSistema,
    rolSistema
  };
};

const requireAuth = (req, res, next) => {
  if (isExcluded(req)) {
    return next();
  }

  if (parseBoolean(process.env.ALLOW_ANONYMOUS)) {
    const authHeader = req.headers.authorization || "";
    const [, token] = authHeader.split(" ");
    if (token) {
      try {
        req.user = verifyToken(token);
        return next();
      } catch (_error) {
        // En modo anónimo no bloqueamos por token inválido; degradamos a usuario anónimo.
      }
    }
    req.user = req.user || buildAnonymousUser();
    return next();
  }

  const authHeader = req.headers.authorization || "";
  const [, token] = authHeader.split(" ");

  if (!token) {
    return res.status(401).json({ mensaje: "Token de autorización requerido." });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (error) {
    const status = error?.name === "TokenExpiredError" ? 401 : 403;
    return res.status(status).json({ mensaje: "Token inválido o expirado." });
  }
};

module.exports = { requireAuth };
