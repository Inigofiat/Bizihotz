const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const supertest = require('supertest');

process.env.NODE_ENV = 'test';

const healthRoutes = require('../src/routes/healthRoutes');

const app = express();
app.use('/health', healthRoutes);

test('GET /health devuelve estado del servicio y de Mongo', async () => {
  const response = await supertest(app).get('/health').expect(200);

  assert.equal(response.body.status, 'ok');
  assert.ok(response.body.service);
  assert.ok(response.body.timestamp);
  assert.match(response.body.db, /connected|disconnected/);
});

