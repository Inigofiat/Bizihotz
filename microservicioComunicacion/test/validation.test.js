const test = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let request;

const setup = async (t) => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.NODE_ENV = 'test';

  await mongoose.connect(process.env.MONGO_URI);
  const app = require('../src/app');
  request = supertest(app);

  t.after(async () => {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.connection.close().catch(() => {});
    await mongod.stop();
  });
};

test('mensaje sin contenido ni adjuntos devuelve 400', async (t) => {
  await setup(t);
  const remitenteId = new mongoose.Types.ObjectId().toString();
  const destinatarioId = new mongoose.Types.ObjectId().toString();

  const res = await request
    .post('/api/messages')
    .send({ remitenteId, destinatarioId })
    .expect(400);

  assert.match(res.body.message || res.body.mensaje || '', /contenido o algun adjunto/i);
});

test('marcar conversacion inexistente como leida devuelve 404', async (t) => {
  await setup(t);
  const fakeConversation = new mongoose.Types.ObjectId().toString();
  const lectorId = new mongoose.Types.ObjectId().toString();

  await request
    .patch(`/api/conversations/${fakeConversation}/read`)
    .send({ lectorId })
    .expect(404);
});
