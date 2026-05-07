const test = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');

const { app } = require('../src/index');

test('GET /health y GET /status responden aunque no haya DB conectada', async () => {
  const health = await supertest(app).get('/health').expect(503);
  const status = await supertest(app).get('/status').expect(503);

  assert.equal(health.body.status, 'degraded');
  assert.equal(health.body.db, 'disconnected');
  assert.equal(status.body.status, 'degraded');
  assert.equal(status.body.db, 'disconnected');
});
