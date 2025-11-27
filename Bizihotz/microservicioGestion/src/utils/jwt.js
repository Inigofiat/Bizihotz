"use strict";

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "1d";

const signToken = (payload = {}) =>
  jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION
  });

const verifyToken = (token = "") => jwt.verify(token, JWT_SECRET);

module.exports = {
  signToken,
  verifyToken
};
