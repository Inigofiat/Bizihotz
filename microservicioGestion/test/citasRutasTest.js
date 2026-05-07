const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');

const Cita = require('../src/models/citaModel');
const router = require('../src/routes/citasRutas');

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
  app.use('/api/citas', router);
  return app;
};

const startServer = async () => {
  const app = createApp();
  const server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
};

const VALID_ID = '507f1f77bcf86cd799439011';

const withPatchedMethod = (methodName, implementation) => {
  const original = Cita[methodName];
  Cita[methodName] = implementation;
  return () => {
    Cita[methodName] = original;
  };
};

test('PATCH /api/citas/:id ajusta estado y atendida de forma coherente', async (t) => {
  const updatedCita = {
    _id: VALID_ID,
    estado: 'Atendida',
    atendida: true,
    notas: 'Revisada'
  };

  const restore = withPatchedMethod('findByIdAndUpdate', async (id, updates, options) => {
    assert.equal(id, VALID_ID);
    assert.equal(updates.estado, 'Atendida');
    assert.equal(updates.atendida, true);
    assert.equal(updates.notas, 'Revisada');
    assert.deepEqual(options, { new: true, runValidators: true });
    return updatedCita;
  });

  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/citas/${VALID_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ estado: 'Atendida', notas: 'Revisada' })
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.estado, 'Atendida');
  assert.equal(body.atendida, true);
  assert.equal(body.notas, 'Revisada');
});

test('PATCH /api/citas/:id rechaza payload sin campos válidos', async (t) => {
  const restore = withPatchedMethod('findByIdAndUpdate', async () => {
    assert.fail('findByIdAndUpdate no debería invocarse cuando no hay campos válidos');
  });
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/citas/${VALID_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ atendida: 'quizá' })
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.mensaje, 'No se han proporcionado campos válidos para actualizar');
});

test('PATCH /api/citas/:id devuelve 404 cuando no existe la cita', async (t) => {
  const restore = withPatchedMethod('findByIdAndUpdate', async () => null);
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/citas/${VALID_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ estado: 'Cancelada' })
  });

  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.mensaje, `Cita con identificador ${VALID_ID} no encontrado.`);
});

test('PATCH /api/citas/:id requiere al menos un campo permitido', async (t) => {
  const restore = withPatchedMethod('findByIdAndUpdate', async () => {
    assert.fail('findByIdAndUpdate no debería invocarse cuando no hay campos');
  });
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/citas/${VALID_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.mensaje, 'No se han proporcionado campos válidos para actualizar');
});
