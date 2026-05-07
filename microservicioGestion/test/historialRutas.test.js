const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');

const HistorialPaciente = require('../src/models/historialPacienteModel');
const router = require('../src/routes/historialRutas');

const VALID_ID = '507f1f77bcf86cd799439011';

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      idUsuario: '507f1f77bcf86cd799439012',
      rolSistema: 'Administrador'
    };
    next();
  });
  app.use('/api/historiales', router);
  return app;
};

const startServer = async () => {
  const app = createApp();
  const server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
};

const withPatchedMethod = (methodName, implementation) => {
  const original = HistorialPaciente[methodName];
  HistorialPaciente[methodName] = implementation;
  return () => {
    HistorialPaciente[methodName] = original;
  };
};

const withPatchedPrototypeMethod = (methodName, implementation) => {
  const original = HistorialPaciente.prototype[methodName];
  HistorialPaciente.prototype[methodName] = implementation;
  return () => {
    HistorialPaciente.prototype[methodName] = original;
  };
};

test('GET /api/historiales valida ObjectId en filtros', async (t) => {
  const restore = withPatchedMethod('find', () => {
    assert.fail('No deberia consultar BD con filtros invalidos');
  });
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/historiales?idPaciente=no-id`);
  assert.equal(response.status, 400);
});

test('GET /api/historiales con paginacion devuelve metadatos', async (t) => {
  const items = [{ _id: VALID_ID, observaciones: 'ok' }];
  const restoreCount = withPatchedMethod('countDocuments', async () => 1);
  const restoreFind = withPatchedMethod('find', () => {
    const chain = {
      sort() {
        return chain;
      },
      skip() {
        return chain;
      },
      limit() {
        return Promise.resolve(items);
      }
    };
    return chain;
  });
  t.after(restoreCount);
  t.after(restoreFind);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/historiales?page=2&limit=10`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, 1);
  assert.equal(body.page, 2);
  assert.equal(body.pageSize, 10);
  assert.equal(body.items.length, 1);
});

test('GET /api/historiales sin paginacion devuelve lista', async (t) => {
  const restoreFind = withPatchedMethod('find', () => {
    const chain = {
      sort() {
        return chain;
      },
      limit() {
        return Promise.resolve([{ _id: VALID_ID }]);
      }
    };
    return chain;
  });
  t.after(restoreFind);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/historiales`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 1);
});

test('GET /api/historiales/:id devuelve 404 si no existe', async (t) => {
  const restore = withPatchedMethod('findById', async () => null);
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/historiales/${VALID_ID}`);
  assert.equal(response.status, 404);
});

test('POST /api/historiales valida idPaciente y crea historial', async (t) => {
  const restoreSave = withPatchedPrototypeMethod('save', async function saveStub() {
    return { ...this.toObject(), _id: VALID_ID };
  });
  t.after(restoreSave);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const bad = await fetch(`${url}/api/historiales`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idPaciente: 'bad-id' })
  });
  assert.equal(bad.status, 400);

  const ok = await fetch(`${url}/api/historiales`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      idPaciente: '507f1f77bcf86cd799439013',
      idUsuario: '507f1f77bcf86cd799439012',
      idCita: '507f1f77bcf86cd799439014',
      observaciones: 'Primera visita'
    })
  });
  assert.equal(ok.status, 201);
});

test('PUT /api/historiales/:id devuelve 404 cuando no existe', async (t) => {
  const restore = withPatchedMethod('findByIdAndUpdate', async () => null);
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/historiales/${VALID_ID}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ observaciones: 'actualizado' })
  });

  assert.equal(response.status, 404);
});

test('DELETE /api/historiales/:id cubre 404 y 204', async (t) => {
  let deleted = false;
  const restore = withPatchedMethod('findByIdAndDelete', async () => {
    if (deleted) {
      return { _id: VALID_ID };
    }
    deleted = true;
    return null;
  });
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const notFound = await fetch(`${url}/api/historiales/${VALID_ID}`, {
    method: 'DELETE'
  });
  assert.equal(notFound.status, 404);

  const removed = await fetch(`${url}/api/historiales/${VALID_ID}`, {
    method: 'DELETE'
  });
  assert.equal(removed.status, 204);
});
