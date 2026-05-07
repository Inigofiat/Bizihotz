const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let request;
let uploadsDir;

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
  uploadsDir = uploadsDir || fs.mkdtempSync(path.join(os.tmpdir(), 'bizihotz-comms-'));
  process.env.UPLOADS_DIR = uploadsDir;
  process.env.MAX_ATTACHMENT_SIZE_MB = '2';

  try {
    await mongoose.connect(process.env.MONGO_URI);
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
    await fs.promises.rm(uploadsDir, { recursive: true, force: true }).catch(() => {});
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.connection.close().catch(() => {});
    if (mongod) {
      await mongod.stop().catch(() => {});
    }
  });
  return true;
};

test('mensaje sin contenido ni adjuntos devuelve 400', async (t) => {
  const ready = await setup(t);
  if (!ready) return;
  const remitenteId = new mongoose.Types.ObjectId().toString();
  const destinatarioId = new mongoose.Types.ObjectId().toString();

  const res = await request
    .post('/api/messages')
    .send({ remitenteId, destinatarioId })
    .expect(400);

  assert.match(res.body.message || res.body.mensaje || '', /contenido o algun adjunto/i);
});

test('marcar conversacion inexistente como leida devuelve 404', async (t) => {
  const ready = await setup(t);
  if (!ready) return;
  const fakeConversation = new mongoose.Types.ObjectId().toString();
  const lectorId = new mongoose.Types.ObjectId().toString();

  await request
    .patch(`/api/conversations/${fakeConversation}/read`)
    .send({ lectorId })
    .expect(404);
});

test('mensaje con solo adjuntos se guarda', async (t) => {
  const ready = await setup(t);
  if (!ready) return;
  const remitenteId = new mongoose.Types.ObjectId().toString();
  const destinatarioId = new mongoose.Types.ObjectId().toString();

  const res = await request
    .post('/api/messages')
    .send({
      remitenteId,
      destinatarioId,
      adjuntos: [
        {
          url: 'http://example.com/nota.pdf',
          nombre: 'nota.pdf',
          tipo: 'file',
          tamano: 1200,
        },
      ],
    })
    .expect(201);

  assert.equal(res.body.data.contenido, '');
  assert.equal(res.body.data.adjuntos.length, 1);
  assert.equal(res.body.data.adjuntos[0].nombre, 'nota.pdf');
});

test('subida de adjuntos devuelve metadatos y guarda el archivo', async (t) => {
  const ready = await setup(t);
  if (!ready) return;
  const res = await request
    .post('/api/uploads/attachments')
    .attach('files', Buffer.from('hola mundo'), 'saludo.txt')
    .expect(201);

  const payload = res.body.data || [];
  assert.ok(Array.isArray(payload));
  assert.equal(payload.length, 1);
  assert.equal(payload[0].nombre, 'saludo.txt');
  const storedName = path.basename(payload[0].url);
  const storedPath = path.join(uploadsDir, 'adjuntos', storedName);
  assert.ok(fs.existsSync(storedPath));
});

