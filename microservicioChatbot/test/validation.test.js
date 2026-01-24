const test = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let request;

let cleanupRegistered = false;
const ensureSetup = async (t) => {
  if (request) return;
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.NODE_ENV = 'test';

  const { connectDatabase } = require('../src/config/database');
  await connectDatabase();
  const app = require('../src/app');
  request = supertest(app);

  if (!cleanupRegistered) {
    cleanupRegistered = true;
    t.after(async () => {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.connection.close().catch(() => {});
      await mongod.stop();
    });
  }
};

test('renombrar sesión por no participante devuelve 403', async (t) => {
  await ensureSetup(t);
  const userA = new mongoose.Types.ObjectId().toString();
  const userB = new mongoose.Types.ObjectId().toString();

  const createRes = await request
    .post('/api/sessions')
    .send({ usuarioId: userA, titulo: 'Sesion A' })
    .expect(201);
  const sessionId = createRes.body.data.id;

  const res = await request
    .patch(`/api/sessions/${sessionId}`)
    .send({ solicitanteId: userB, titulo: 'Hack' })
    .expect(403);

  assert.match(res.body.mensaje || res.body.message || '', /No perteneces/);
});

test('crear sesión sin usuarioId devuelve 400', async (t) => {
  await ensureSetup(t);
  await request.post('/api/sessions').send({}).expect(400);
});
