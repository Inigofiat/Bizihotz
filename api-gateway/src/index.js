"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const http = require("http");
const https = require("https");
const { pipeline } = require("node:stream");
const swaggerUi = require("swagger-ui-express");

const { getConfig } = require("./lib/config");
const { aggregateSpecs } = require("./lib/openapiAggregator");
const { errorHandler } = require("./middleware/errorHandler");

const config = getConfig();
const app = express();

app.use(compression());
app.use(cors());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    gateway: {
      port: config.port,
      services: config.services.map((service) => ({
        name: service.name,
        route: service.route,
        target: service.target,
        hasOpenApi: Boolean(service.openapiUrl)
      }))
    }
  });
});

const setCorsHeaders = (res, origin, allowHeaders = null, allowMethods = null) => {
  const normalizedOrigin = origin || "*";
  res.setHeader("Access-Control-Allow-Origin", normalizedOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Headers",
    allowHeaders || "Authorization, Content-Type, X-Requested-With, Accept"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    allowMethods || "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  const currentExpose = res.getHeader("Access-Control-Expose-Headers");
  if (!currentExpose) {
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  }
  const vary = res.getHeader("Vary");
  res.setHeader("Vary", vary ? `${vary}, Origin` : "Origin");
};

const forwardRequest = (service, req, res, next) => {
  const routePattern = new RegExp("^" + service.route);
  const targetPath = req.originalUrl.replace(routePattern, "") || "/";
  const targetUrl = new URL(targetPath, service.target);

  const options = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.host,
      // Identificador que permite al microservicio reconocer peticiones proxied por el Gateway
      'x-forwarded-by': 'bizihotz-gateway'
    }
  };

  const agent = targetUrl.protocol === "https:" ? https : http;

  const proxyRequest = agent.request(options, (proxyResponse) => {
    const headers = { ...proxyResponse.headers };
    delete headers["transfer-encoding"];
    setCorsHeaders(res, req.headers.origin);

    res.writeHead(proxyResponse.statusCode ?? 500, proxyResponse.statusMessage ?? "", headers);

    pipeline(proxyResponse, res, (error) => {
      if (error) {
        next(error);
      }
    });
  });

  proxyRequest.on("error", (error) => {
    next(error);
  });

  pipeline(req, proxyRequest, (error) => {
    if (error) {
      proxyRequest.destroy(error);
      next(error);
    }
  });
};

config.services.forEach((service) => {
  app.use(service.route, (req, res, next) => {
    if (req.method === "OPTIONS") {
      setCorsHeaders(
        res,
        req.headers.origin,
        req.headers["access-control-request-headers"],
        req.headers["access-control-request-method"]
      );
      res.status(204).end();
      return;
    }

    forwardRequest(service, req, res, next);
  });
});

app.get("/openapi.json", async (_req, res, next) => {
  try {
    const spec = await aggregateSpecs(config.services);
    res.json(spec);
  } catch (error) {
    next(error);
  }
});

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(null, {
    swaggerOptions: {
      url: "/openapi.json",
      docExpansion: "list"
    },
    customSiteTitle: "Bizihotz API Gateway"
  })
);

app.use((_req, res) => {
  res.status(404).json({ error: "NotFound", message: "Ruta no encontrada en el Gateway" });
});

app.use(errorHandler);

const start = () => {
  app.listen(config.port, () => {
    console.log("API Gateway Bizihotz escuchando en el puerto " + config.port);
  });
};

if (require.main === module) {
  start();
}

module.exports = {
  app,
  start
};
