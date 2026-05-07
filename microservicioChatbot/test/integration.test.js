const test = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let request;
let connectDatabase;

const setup = async (t) => {
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

  ({ connectDatabase } = require('../src/config/database'));
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

  t.after(async () => {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.connection.close().catch(() => {});
    if (mongod) {
      await mongod.stop().catch(() => {});
    }
  });
  return true;
};

const clearData = async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((col) => col.deleteMany({})));
};

test('chatbot: crear sesion, enviar mensajes, renombrar y eliminar', async (t) => {
  const ready = await setup(t);
  if (!ready) return;
  await clearData();

  const usuarioId = new mongoose.Types.ObjectId().toString();

  const createRes = await request
    .post('/api/sessions')
    .send({ usuarioId, titulo: 'Sesion de prueba' })
    .expect(201);
  const session = createRes.body.data;
  assert.ok(session.id);
  assert.equal(session.titulo, 'Sesion de prueba');
  assert.equal(session.participantes.includes(usuarioId), true);

  const listRes = await request
    .get('/api/sessions')
    .query({ usuarioId })
    .expect(200);
  const sessions = listRes.body.data || listRes.body;
  assert.equal(sessions.length, 1);

  const msgRes = await request
    .post(`/api/sessions/${session.id}/messages`)
    .send({ remitenteId: usuarioId, contenido: 'Hola bot' })
    .expect(201);
  assert.equal(msgRes.body.data.contenido, 'Hola bot');

  const getMsgs = await request
    .get(`/api/sessions/${session.id}/messages`)
    .expect(200);
  const items = getMsgs.body.items || getMsgs.body.data?.items || [];
  assert.equal(items.length, 1);
  assert.equal(items[0].contenido, 'Hola bot');

  const renameRes = await request
    .patch(`/api/sessions/${session.id}`)
    .send({ solicitanteId: usuarioId, titulo: 'Sesion renombrada' })
    .expect(200);
  assert.equal(renameRes.body.data.titulo, 'Sesion renombrada');

  await request
    .delete(`/api/sessions/${session.id}`)
    .send({ solicitanteId: usuarioId })
    .expect(200);

  await request.get(`/api/sessions/${session.id}`).expect(404);
});

