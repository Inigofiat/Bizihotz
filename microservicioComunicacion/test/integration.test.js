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
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.NODE_ENV = 'test';

  // Cargamos después de fijar las variables de entorno
  ({ connectMongo, closeMongo } = require('../src/config/database'));
  await connectMongo();

  const app = require('../src/app');
  request = supertest(app);

  t.after(async () => {
    await mongoose.connection.dropDatabase().catch(() => {});
    await closeMongo();
    await mongod.stop();
  });
};

const clearData = async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((col) => col.deleteMany({}))
  );
};

test('mensajería: crear mensaje, listar conversaciones, leer y borrar', async (t) => {
  await setup(t);
  await clearData();

  const remitenteId = new mongoose.Types.ObjectId().toString();
  const destinatarioId = new mongoose.Types.ObjectId().toString();

  // Enviar mensaje crea conversación
  const sendRes = await request
    .post('/api/messages')
    .send({
      remitenteId,
      destinatarioId,
      contenido: 'Hola desde test'
    })
    .expect(201);

  const message = sendRes.body.data;
  assert.ok(message);
  assert.equal(message.remitenteId, remitenteId);

  const conversationId = message.conversacionId || message.conversationId || message.idConversacion;
  assert.ok(conversationId, 'conversacionId debería estar presente');

  // Listado de conversaciones para remitente incluye no leídos para el destinatario
  const listRes = await request
    .get('/api/conversations')
    .query({ usuarioId: remitenteId })
    .expect(200);
  const conversations = listRes.body.data || listRes.body;
  assert.equal(conversations.length, 1);
  assert.deepEqual(new Set(conversations[0].participantes), new Set([remitenteId, destinatarioId]));

  // Obtener mensajes de la conversación
  const messagesRes = await request
    .get(`/api/conversations/${conversationId}/messages`)
    .expect(200);
  const messages = messagesRes.body.data?.items || messagesRes.body.data || messagesRes.body.items || messagesRes.body;
  assert.ok(Array.isArray(messages));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].contenido || messages[0].content, 'Hola desde test');

  // Marcar conversación como leída por el destinatario
  const readRes = await request
    .patch(`/api/conversations/${conversationId}/read`)
    .send({ lectorId: destinatarioId })
    .expect(200);
  const convo = readRes.body.data || readRes.body;
  assert.equal(convo.noLeidos?.[destinatarioId] ?? 0, 0);

  // Borrar conversación
  await request
    .delete(`/api/conversations/${conversationId}`)
    .send({ solicitanteId: remitenteId })
    .expect(200);

  // Conversación ya no existe
  await request
    .get(`/api/conversations/${conversationId}/messages`)
    .expect(404);
});
