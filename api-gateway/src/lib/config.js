"use strict";

const DEFAULT_PORT = 5000;

const normalizeUrl = (value) => {
  if (!value) {
    return undefined;
  }
  return value.replace(/\/+$/, "");
};

const buildServiceConfig = (env, key, defaults = {}) => {
  const serviceUrl = normalizeUrl(env[`${key}_SERVICE_URL`]);
  const openapiUrl = env[`${key}_OPENAPI_URL`];
  if (!serviceUrl) {
    return undefined;
  }

  return {
    name: key.toLowerCase(),
    route: defaults.route ?? `/${key.toLowerCase()}`,
    target: serviceUrl,
    openapiUrl: openapiUrl ? openapiUrl.trim() : undefined
  };
};

const SERVICES_KEYS = [
  { key: "GESTION", route: "/gestion" },
  { key: "NUTRICION", route: "/nutricion" },
  { key: "COMUNICACION", route: "/comunicacion" },
  { key: "DOCUMENTOS", route: "/documentos" }
];

const getConfig = () => {
  const port = Number.parseInt(process.env.PORT ?? DEFAULT_PORT, 10);

  const services = SERVICES_KEYS
    .map((entry) => buildServiceConfig(process.env, entry.key, { route: entry.route }))
    .filter(Boolean);

  return {
    port: Number.isNaN(port) ? DEFAULT_PORT : port,
    services
  };
};

module.exports = {
  getConfig
};
