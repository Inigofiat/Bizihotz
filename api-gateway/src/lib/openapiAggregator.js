"use strict";

const path = require("path");
const fs = require("fs/promises");

const BASE_SPEC = {
  openapi: "3.0.3",
  info: {
    title: "Bizihotz API Gateway",
    version: "1.0.0",
    description:
      "Documentacion agregada dinamicamente a partir de los microservicios activos."
  },
  servers: [
    {
      url: "/",
      description: "API Gateway"
    }
  ],
  paths: {},
  components: {}
};

const readLocalSpec = async (relativePath) => {
  const absolutePath = path.resolve(relativePath);
  const raw = await fs.readFile(absolutePath, "utf-8");
  return JSON.parse(raw);
};

const fetchRemoteSpec = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`Error ${response.status} al recuperar OpenAPI en ${url}`);
  }
  return response.json();
};

const mergeObjects = (target, source) => {
  if (!source) {
    return;
  }

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      if (!target[key]) {
        target[key] = {};
      }
      mergeObjects(target[key], value);
    } else if (target[key] === undefined) {
      target[key] = value;
    }
  }
};

const mergeSpecs = (base, spec, prefix) => {
  if (!spec) {
    return;
  }

  const formattedPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;

  for (const [pathKey, pathValue] of Object.entries(spec.paths ?? {})) {
    const prefixedPath = `${formattedPrefix}${pathKey}`;
    if (!base.paths[prefixedPath]) {
      base.paths[prefixedPath] = pathValue;
    } else {
      base.paths[prefixedPath] = {
        ...base.paths[prefixedPath],
        ...pathValue
      };
    }
  }

  if (spec.components) {
    if (!base.components) {
      base.components = {};
    }
    mergeObjects(base.components, spec.components);
  }
};

const loadSpec = async (service) => {
  if (!service.openapiUrl) {
    return undefined;
  }

  try {
    if (service.openapiUrl.startsWith("file:")) {
      return await readLocalSpec(service.openapiUrl.replace("file:", ""));
    }
    return await fetchRemoteSpec(service.openapiUrl);
  } catch (error) {
    console.warn(
      `[openapi] No se pudo cargar la especificacion de ${service.name}: ${error.message}`
    );
    return undefined;
  }
};

const aggregateSpecs = async (services) => {
  const aggregated = JSON.parse(JSON.stringify(BASE_SPEC));

  for (const service of services) {
    const spec = await loadSpec(service);
    if (!spec) {
      continue;
    }

    mergeSpecs(aggregated, spec, service.route);
  }

  return aggregated;
};

module.exports = {
  aggregateSpecs
};
