const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');

const Cita = require('../src/models/citaModel');
const router = require('../src/routes/citasRutas');

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

const withPatchedMethod = (methodName, implementation) => {
  const original = Cita[methodName];
  Cita[methodName] = implementation;
  return () => {
    Cita[methodName] = original;
  };
};

const withPatchedPrototypeMethod = (methodName, implementation) => {
  const original = Cita.prototype[methodName];
  Cita.prototype[methodName] = implementation;
  return () => {
    Cita.prototype[methodName] = original;
  };
};

test('GET /api/citas valida query atendida', async (t) => {
  const restore = withPatchedMethod('find', () => {
    assert.fail('No deberia consultar BD con query invalida');
  });
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/citas?atendida=maybe`);
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.mensaje, /atendida debe ser true o false/i);
});

test('GET /api/citas valida fechaDesde', async (t) => {
  const restore = withPatchedMethod('find', () => {
    assert.fail('No deberia consultar BD con fecha invalida');
  });
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/citas?fechaDesde=no-fecha`);
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.mensaje, /fechaDesde/i);
});

test('GET /api/citas transforma y filtra profesionales', async (t) => {
  const citaProfesional = {
    _id: VALID_ID,
    idPaciente: { nombrePaciente: 'Ana', apellidos: 'Perez' },
    idUsuario: { nombre: 'Luis', apellidos: 'Gomez', rolSistema: 'Profesional del centro' },
    tipoConsulta: 'Revision',
    estado: 'Pendiente',
    atendida: false
  };

  const citaAdmin = {
    _id: '507f1f77bcf86cd799439099',
    idPaciente: { nombrePaciente: 'No', apellidos: 'Mostrar' },
    idUsuario: { nombre: 'Admin', apellidos: 'Root', rolSistema: 'Administrador' },
    tipoConsulta: 'Oculta',
    estado: 'Pendiente',
    atendida: false
  };

  const restore = withPatchedMethod('find', (filtro) => {
    assert.equal(filtro.atendida, true);
    const chain = {
      populate() {
        return chain;
      },
      sort() {
        return chain;
      },
      lean() {
        return Promise.resolve([citaProfesional, citaAdmin]);
      }
    };
    return chain;
  });
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/citas?atendida=true`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].paciente, 'Ana Perez');
  assert.equal(body[0].profesional, 'Luis Gomez');
  assert.equal(body[0].motivo, 'Revision');
  assert.equal(body[0].estado, 'Pendiente');
});

test('POST /api/citas aplica normalizacion de estado', async (t) => {
  const restore = withPatchedPrototypeMethod('save', async function saveStub() {
    return {
      ...this.toObject(),
      _id: VALID_ID
    };
  });
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/citas`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fechaCita: '2026-05-06T10:00:00.000Z',
      hora: '10:00',
      tipoConsulta: 'Control',
      idUsuario: '507f1f77bcf86cd799439012',
      idPaciente: '507f1f77bcf86cd799439013',
      estado: 'atendida'
    })
  });

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.estado, 'Atendida');
  assert.equal(body.atendida, true);
});

test('PUT /api/citas/:id bloquea acceso directo en produccion', async (t) => {
  const previousEnv = process.env.NODE_ENV;
  const previousAllow = process.env.ALLOW_DIRECT;
  process.env.NODE_ENV = 'production';
  process.env.ALLOW_DIRECT = 'false';

  t.after(() => {
    process.env.NODE_ENV = previousEnv;
    process.env.ALLOW_DIRECT = previousAllow;
  });

  const restore = withPatchedMethod('findByIdAndUpdate', async () => {
    assert.fail('No deberia invocarse update al bloquear acceso directo');
  });
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/citas/${VALID_ID}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ estado: 'Pendiente' })
  });

  assert.equal(response.status, 403);
  const body = await response.json();
  assert.match(body.mensaje, /api gateway/i);
});

test('PUT /api/citas/:id permite cabecera de gateway y actualiza', async (t) => {
  const previousEnv = process.env.NODE_ENV;
  const previousAllow = process.env.ALLOW_DIRECT;
  process.env.NODE_ENV = 'production';
  process.env.ALLOW_DIRECT = 'false';

  t.after(() => {
    process.env.NODE_ENV = previousEnv;
    process.env.ALLOW_DIRECT = previousAllow;
  });

  const restore = withPatchedMethod('findByIdAndUpdate', async (id, updates, options) => {
    assert.equal(id, VALID_ID);
    assert.equal(updates.estado, 'Cancelada');
    assert.equal(updates.atendida, false);
    assert.deepEqual(options, { new: true, runValidators: true });
    return { _id: id, ...updates };
  });
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/citas/${VALID_ID}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-by': 'bizihotz-gateway'
    },
    body: JSON.stringify({
      idUsuario: '507f1f77bcf86cd799439012',
      idPaciente: '507f1f77bcf86cd799439013',
      estado: 'Cancelada'
    })
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.estado, 'Cancelada');
  assert.equal(body.atendida, false);
});

test('PATCH /api/citas/:id/atendida requiere booleano', async (t) => {
  const restore = withPatchedMethod('findByIdAndUpdate', async () => {
    assert.fail('No deberia actualizarse con tipo invalido');
  });
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/citas/${VALID_ID}/atendida`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ atendida: 'si' })
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.mensaje, /debe ser booleano/i);
});

test('PATCH /api/citas/:id/atendida devuelve 404 si no existe', async (t) => {
  const restore = withPatchedMethod('findByIdAndUpdate', async () => null);
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/citas/${VALID_ID}/atendida`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ atendida: true })
  });

  assert.equal(response.status, 404);
});

test('DELETE /api/citas/:id devuelve 404 si no existe', async (t) => {
  const restore = withPatchedMethod('findByIdAndDelete', async () => null);
  t.after(restore);

  const { server, url } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${url}/api/citas/${VALID_ID}`, {
    method: 'DELETE'
  });

  assert.equal(response.status, 404);
});
