const test = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let request;
let connectDatabase;

const setup = async (t) => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.NODE_ENV = 'test';

  ({ connectDatabase } = require('../src/config/database'));
  await connectDatabase();

  const app = require('../src/app');
  request = supertest(app);

  t.after(async () => {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.connection.close().catch(() => {});
    await mongod.stop();
  });
};

const clearData = async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((col) => col.deleteMany({})));
};

test('chatbot: crear sesión, enviar mensajes, renombrar y eliminar', async (t) => {
  await setup(t);
  await clearData();

  const usuarioId = new mongoose.Types.ObjectId().toString();

  // Crear sesión
  const createRes = await request
    .post('/api/sessions')
    .send({ usuarioId, titulo: 'Sesion de prueba' })
    .expect(201);
  const session = createRes.body.data;
  assert.ok(session.id);
  assert.equal(session.titulo, 'Sesion de prueba');
  assert.equal(session.participantes.includes(usuarioId), true);

  // Listar sesiones del usuario
  const listRes = await request
    .get('/api/sessions')
    .query({ usuarioId })
    .expect(200);
  const sessions = listRes.body.data || listRes.body;
  assert.equal(sessions.length, 1);

  // Enviar mensaje de usuario
  const msgRes = await request
    .post(`/api/sessions/${session.id}/messages`)
    .send({ remitenteId: usuarioId, contenido: 'Hola bot' })
    .expect(201);
  assert.equal(msgRes.body.data.contenido, 'Hola bot');

  // Obtener mensajes de la sesión
  const getMsgs = await request
    .get(`/api/sessions/${session.id}/messages`)
    .expect(200);
  const items = getMsgs.body.items || getMsgs.body.data?.items || [];
  assert.equal(items.length, 1);
  assert.equal(items[0].contenido, 'Hola bot');

  // Renombrar sesión
  const renameRes = await request
    .patch(`/api/sessions/${session.id}`)
    .send({ solicitanteId: usuarioId, titulo: 'Sesion renombrada' })
    .expect(200);
  assert.equal(renameRes.body.data.titulo, 'Sesion renombrada');

  // Eliminar sesión
  await request
    .delete(`/api/sessions/${session.id}`)
    .send({ solicitanteId: usuarioId })
    .expect(200);

  // Obtener sesión ahora debe fallar
  await request.get(`/api/sessions/${session.id}`).expect(404);
});
