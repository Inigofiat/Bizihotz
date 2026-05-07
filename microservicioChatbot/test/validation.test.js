const test = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let request;
let cleanupRegistered = false;

const ensureSetup = async (t) => {
  if (request) return true;
  const externalMongoUri = process.env.TEST_MONGO_URI || process.env.MONGO_URI;
  if (externalMongoUri) {
    process.env.MONGO_URI = externalMongoUri;
    mongod = null;
  } else {
    try {
      mongod = await MongoMemoryServer.create();
    } catch (_error) {
      t.skip('MongoMemoryServer no disponible en este entorno; define TEST_MONGO_URI para ejecutar este test.');
      return false;
    }
    process.env.MONGO_URI = mongod.getUri();
  }
  process.env.NODE_ENV = 'test';

  const { connectDatabase } = require('../src/config/database');
  try {
    await connectDatabase();
  } catch (error) {
    t.skip(`No se pudo conectar a Mongo en tests: ${error.message}`);
    if (mongod) {
      await mongod.stop().catch(() => {});
    }
    return false;
  }

  const app = require('../src/app');
  request = supertest(app);

  if (!cleanupRegistered) {
    cleanupRegistered = true;
    t.after(async () => {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.connection.close().catch(() => {});
      if (mongod) {
        await mongod.stop().catch(() => {});
      }
    });
  }
  return true;
};

test('renombrar sesion por no participante devuelve 403', async (t) => {
  const ready = await ensureSetup(t);
  if (!ready) return;
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

test('crear sesion sin usuarioId devuelve 400', async (t) => {
  const ready = await ensureSetup(t);
  if (!ready) return;
  await request.post('/api/sessions').send({}).expect(400);
});

