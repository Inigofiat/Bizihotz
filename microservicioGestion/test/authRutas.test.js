const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const supertest = require('supertest');
const bcrypt = require('bcryptjs');

const Usuario = require('../src/models/usuarioModel');
const authRoutes = require('../src/routes/authRutas');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return supertest(app);
};

const patch = (object, key, value) => {
  const original = object[key];
  object[key] = value;
  return () => {
    object[key] = original;
  };
};

test('POST /api/auth/login valida datos obligatorios', async () => {
  const request = createApp();
  const response = await request.post('/api/auth/login').send({});
  assert.equal(response.status, 400);
});

test('POST /api/auth/login devuelve 401 si no existe usuario', async (t) => {
  const restoreFindOne = patch(Usuario, 'findOne', async () => null);
  t.after(restoreFindOne);

  const request = createApp();
  const response = await request
    .post('/api/auth/login')
    .send({ email: 'nadie@example.com', password: '12345678' });

  assert.equal(response.status, 401);
});

test('POST /api/auth/login devuelve 401 si password es invalido', async (t) => {
  const fakeUser = {
    contraseniaHash: 'hash',
    toJSON: () => ({
      idUsuario: 'u-1',
      nombreUsuario: 'pro',
      email: 'pro@example.com',
      rol: 'Profesional'
    })
  };

  const restoreFindOne = patch(Usuario, 'findOne', async () => fakeUser);
  const restoreCompare = patch(bcrypt, 'compare', async () => false);
  t.after(restoreFindOne);
  t.after(restoreCompare);

  const request = createApp();
  const response = await request
    .post('/api/auth/login')
    .send({ identificador: 'pro', password: 'badpass' });

  assert.equal(response.status, 401);
});

test('POST /api/auth/login responde 200 y token en caso valido', async (t) => {
  const fakeUser = {
    _id: 'u-1',
    contraseniaHash: 'hash',
    toJSON: () => ({
      idUsuario: 'u-1',
      nombreUsuario: 'pro',
      email: 'pro@example.com',
      rol: 'Profesional',
      rolSistema: 'Profesional del centro',
      nombre: 'Pro',
      apellidos: 'Bar',
      telefono: '600000000',
      foto: '',
      debeActualizarCont: false,
      ultimoCambioCont: null,
      ultimoAcceso: null
    })
  };

  const restoreFindOne = patch(Usuario, 'findOne', async () => fakeUser);
  const restoreCompare = patch(bcrypt, 'compare', async () => true);
  const restoreUpdate = patch(Usuario, 'updateOne', async () => ({ acknowledged: true }));
  t.after(restoreFindOne);
  t.after(restoreCompare);
  t.after(restoreUpdate);

  const request = createApp();
  const response = await request
    .post('/api/auth/login')
    .send({ email: 'pro@example.com', password: 'ok-pass-123' });

  assert.equal(response.status, 200);
  assert.ok(response.body.token);
  assert.equal(response.body.usuario.idUsuario, 'u-1');
});

test('POST /api/auth/logout responde 200', async () => {
  const request = createApp();
  const response = await request.post('/api/auth/logout').send({});
  assert.equal(response.status, 200);
});

test('POST /api/auth/cambiar-password valida payload', async () => {
  const request = createApp();
  const missing = await request.post('/api/auth/cambiar-password').send({});
  assert.equal(missing.status, 400);

  const shortPassword = await request
    .post('/api/auth/cambiar-password')
    .send({ email: 'a@b.com', passwordActual: '12345678', passwordNueva: 'short' });
  assert.equal(shortPassword.status, 400);
});

test('POST /api/auth/cambiar-password cubre 404 y 401', async (t) => {
  const request = createApp();

  const restoreFindNone = patch(Usuario, 'findOne', async () => null);
  t.after(restoreFindNone);
  const notFound = await request
    .post('/api/auth/cambiar-password')
    .send({ email: 'x@y.com', passwordActual: '12345678', passwordNueva: '123456789' });
  assert.equal(notFound.status, 404);
  restoreFindNone();

  const fakeUser = { contraseniaHash: 'hash' };
  const restoreFindOne = patch(Usuario, 'findOne', async () => fakeUser);
  const restoreCompare = patch(bcrypt, 'compare', async () => false);
  t.after(restoreFindOne);
  t.after(restoreCompare);
  const wrongPass = await request
    .post('/api/auth/cambiar-password')
    .send({ email: 'x@y.com', passwordActual: 'bad', passwordNueva: '123456789' });
  assert.equal(wrongPass.status, 401);
});

test('POST /api/auth/cambiar-password cubre no cambio y cambio exitoso', async (t) => {
  const request = createApp();
  let saveCalled = false;

  const fakeUser = {
    contraseniaHash: 'hash-old',
    debeActualizarCont: true,
    ultimoCambioCont: null,
    async save() {
      saveCalled = true;
    }
  };

  let compareCall = 0;
  const restoreFindOne = patch(Usuario, 'findOne', async () => fakeUser);
  const restoreCompare = patch(bcrypt, 'compare', async () => {
    compareCall += 1;
    if (compareCall === 1) return true;
    return true;
  });
  t.after(restoreFindOne);
  t.after(restoreCompare);

  const samePassword = await request
    .post('/api/auth/cambiar-password')
    .send({ email: 'x@y.com', passwordActual: 'good', passwordNueva: 'good' });
  assert.equal(samePassword.status, 400);

  compareCall = 0;
  restoreCompare();
  const restoreCompare2 = patch(bcrypt, 'compare', async () => {
    compareCall += 1;
    if (compareCall === 1) return true;
    return false;
  });
  const restoreHash = patch(bcrypt, 'hash', async () => 'hash-new');
  t.after(restoreCompare2);
  t.after(restoreHash);

  const changed = await request
    .post('/api/auth/cambiar-password')
    .send({ email: 'x@y.com', passwordActual: 'good', passwordNueva: 'new-good-password' });
  assert.equal(changed.status, 200);
  assert.equal(saveCalled, true);
});

test('POST /api/auth/confirmar-password cubre 400/404/401/200', async (t) => {
  const request = createApp();

  const missing = await request.post('/api/auth/confirmar-password').send({});
  assert.equal(missing.status, 400);

  const restoreFindNone = patch(Usuario, 'findOne', async () => null);
  t.after(restoreFindNone);
  const notFound = await request
    .post('/api/auth/confirmar-password')
    .send({ email: 'x@y.com', passwordActual: 'abc' });
  assert.equal(notFound.status, 404);
  restoreFindNone();

  let saveCalled = false;
  const fakeUser = {
    contraseniaHash: 'hash',
    async save() {
      saveCalled = true;
    }
  };
  const restoreFindOne = patch(Usuario, 'findOne', async () => fakeUser);
  const restoreCompareBad = patch(bcrypt, 'compare', async () => false);
  t.after(restoreFindOne);
  t.after(restoreCompareBad);
  const wrong = await request
    .post('/api/auth/confirmar-password')
    .send({ email: 'x@y.com', passwordActual: 'abc' });
  assert.equal(wrong.status, 401);

  restoreCompareBad();
  const restoreCompareOk = patch(bcrypt, 'compare', async () => true);
  t.after(restoreCompareOk);
  const ok = await request
    .post('/api/auth/confirmar-password')
    .send({ email: 'x@y.com', passwordActual: 'abc' });
  assert.equal(ok.status, 200);
  assert.equal(saveCalled, true);
});
