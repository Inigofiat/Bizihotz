"use strict";

const { verifyToken } = require("../utils/jwt");

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

const requireAuth = (req, res, next) => {
  if (isExcluded(req)) {
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
