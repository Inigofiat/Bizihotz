const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const supertest = require('supertest');
const jwt = require('jsonwebtoken');

const { requireAuth } = require('../src/middlewares/auth');
const { signToken } = require('../src/utils/jwt');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(requireAuth);
  app.get('/status', (_req, res) => res.json({ ok: true }));
  app.get('/api/private', (req, res) => res.json({ ok: true, user: req.user || null }));
  return supertest(app);
};

test('middleware auth permite rutas excluidas', async () => {
  const request = buildApp();
  const response = await request.get('/status');
  assert.equal(response.status, 200);
});

test('middleware auth devuelve 401 sin token', async () => {
  const request = buildApp();
  const response = await request.get('/api/private');
  assert.equal(response.status, 401);
});

test('middleware auth devuelve 403 con token invalido', async () => {
  const request = buildApp();
  const response = await request
    .get('/api/private')
    .set('Authorization', 'Bearer token-no-valido');
  assert.equal(response.status, 403);
});

test('middleware auth devuelve 401 con token expirado', async () => {
  const request = buildApp();
  const expiredToken = jwt.sign({ idUsuario: 'u1' }, JWT_SECRET, { expiresIn: -1 });
  const response = await request
    .get('/api/private')
    .set('Authorization', `Bearer ${expiredToken}`);
  assert.equal(response.status, 401);
});

test('middleware auth permite acceso con token valido', async () => {
  const request = buildApp();
  const token = signToken({ idUsuario: 'u1', rolSistema: 'Administrador' });
  const response = await request
    .get('/api/private')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.user.idUsuario, 'u1');
});
