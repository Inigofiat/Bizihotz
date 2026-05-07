const test = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let request;
let connectMongo;
let closeMongo;

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

  ({ connectMongo, closeMongo } = require('../src/config/database'));
  try {
    await connectMongo();
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
    await closeMongo().catch(() => {});
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

test('mensajeria: crear mensaje, listar conversaciones, leer y borrar', async (t) => {
  const ready = await setup(t);
  if (!ready) return;
  await clearData();

  const remitenteId = new mongoose.Types.ObjectId().toString();
  const destinatarioId = new mongoose.Types.ObjectId().toString();

  const sendRes = await request
    .post('/api/messages')
    .send({
      remitenteId,
      destinatarioId,
      contenido: 'Hola desde test',
    })
    .expect(201);

  const message = sendRes.body.data;
  assert.ok(message);
  assert.equal(message.remitenteId, remitenteId);

  const conversationId = message.conversacionId || message.conversationId || message.idConversacion;
  assert.ok(conversationId, 'conversacionId deberia estar presente');

  const listRes = await request
    .get('/api/conversations')
    .query({ usuarioId: remitenteId })
    .expect(200);
  const conversations = listRes.body.data || listRes.body;
  assert.equal(conversations.length, 1);
  assert.deepEqual(new Set(conversations[0].participantes), new Set([remitenteId, destinatarioId]));

  const messagesRes = await request
    .get(`/api/conversations/${conversationId}/messages`)
    .expect(200);
  const messages = messagesRes.body.data?.items || messagesRes.body.data || messagesRes.body.items || messagesRes.body;
  assert.ok(Array.isArray(messages));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].contenido || messages[0].content, 'Hola desde test');

  const readRes = await request
    .patch(`/api/conversations/${conversationId}/read`)
    .send({ lectorId: destinatarioId })
    .expect(200);
  const convo = readRes.body.data || readRes.body;
  assert.equal(convo.noLeidos?.[destinatarioId] ?? 0, 0);

  await request
    .delete(`/api/conversations/${conversationId}`)
    .send({ solicitanteId: remitenteId })
    .expect(200);

  await request
    .get(`/api/conversations/${conversationId}/messages`)
    .expect(404);
});

