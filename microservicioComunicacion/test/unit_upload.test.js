const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const supertest = require('supertest');

process.env.NODE_ENV = 'test';
process.env.MAX_ATTACHMENT_SIZE_MB = '1';
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bizihotz-upload-unit-'));
process.env.UPLOADS_DIR = uploadsDir;

const uploadRoutes = require('../src/routes/uploadRoutes');
const errorHandler = require('../src/middlewares/errorHandler');

const app = express();
app.use('/api/uploads', uploadRoutes);
app.use(errorHandler);

test('uploadRoutes: rechaza peticiones sin archivos', async () => {
  const response = await supertest(app).post('/api/uploads/attachments').expect(400);
  assert.match(response.body.message || '', /no se recibieron archivos/i);
});

test('uploadRoutes: guarda archivo y devuelve metadatos', async (t) => {
  const response = await supertest(app)
    .post('/api/uploads/attachments')
    .attach('files', Buffer.from('contenido'), 'nota.txt')
    .expect(201);

  const payload = response.body.data || [];
  assert.equal(payload.length, 1);
  assert.equal(payload[0].nombre, 'nota.txt');
  assert.match(payload[0].url, /\/uploads\/adjuntos\//);

  const storedName = path.basename(payload[0].url);
  const storedPath = path.join(uploadsDir, 'adjuntos', storedName);
  assert.equal(fs.existsSync(storedPath), true);

  t.after(async () => {
    await fs.promises.rm(uploadsDir, { recursive: true, force: true }).catch(() => {});
  });
});

