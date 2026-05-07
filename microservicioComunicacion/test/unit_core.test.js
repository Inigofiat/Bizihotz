const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const supertest = require('supertest');
const { body } = require('express-validator');
const createError = require('http-errors');

const asyncHandler = require('../src/utils/asyncHandler');
const socketEmitter = require('../src/utils/socketEmitter');
const validateRequest = require('../src/middlewares/validateRequest');
const errorHandler = require('../src/middlewares/errorHandler');

process.env.NODE_ENV = 'test';

test('asyncHandler resuelve y reenvia errores a next', async () => {
  let called = false;
  const okFn = asyncHandler(async (_req, res) => {
    called = true;
    res.status(204).send();
  });
  const resOk = { status: () => ({ send: () => {} }) };
  await okFn({}, resOk, () => {});
  assert.equal(called, true);

  const boom = new Error('boom');
  let captured;
  const failFn = asyncHandler(async () => {
    throw boom;
  });
  await failFn({}, {}, (err) => {
    captured = err;
  });
  assert.equal(captured, boom);
});

test('socketEmitter emite a usuarios unicos y permite resetear io', () => {
  const events = [];
  const io = {
    to(room) {
      return {
        emit(event, payload) {
          events.push({ room, event, payload });
        },
      };
    },
  };

  socketEmitter.setSocketServer(io);
  assert.equal(socketEmitter.getSocketServer(), io);

  socketEmitter.emitToUser('123', 'message:new', { ok: true });
  socketEmitter.emitToUsers(['123', '123', '456', null], 'conversation:deleted', { id: 1 });

  assert.equal(events.length, 3);
  assert.deepEqual(events.map((item) => item.room), ['user:123', 'user:123', 'user:456']);
});

test('validateRequest devuelve 422 cuando falla validacion', async () => {
  const app = express();
  app.use(express.json());
  app.post(
    '/val',
    [body('nombre').isLength({ min: 3 }).withMessage('nombre invalido')],
    validateRequest,
    (_req, res) => res.json({ ok: true })
  );
  app.use(errorHandler);

  const bad = await supertest(app).post('/val').send({ nombre: 'ab' }).expect(422);
  assert.match(bad.body.message || '', /solicitud invalida/i);
  assert.ok(Array.isArray(bad.body.details));
  assert.match(String(bad.body.details[0].message || ''), /nombre invalido/i);

  const good = await supertest(app).post('/val').send({ nombre: 'abcd' }).expect(200);
  assert.equal(good.body.ok, true);
});

test('errorHandler normaliza errores 500 y expone detalles de http errors', () => {
  const payloads = [];
  const res = {
    status(code) {
      this.code = code;
      return this;
    },
    json(payload) {
      payloads.push({ code: this.code, payload });
      return this;
    },
  };

  errorHandler(new Error('interno'), {}, res, () => {});
  assert.equal(payloads[0].code, 500);
  assert.match(payloads[0].payload.message, /error inesperado/i);

  const httpErr = createError(422, 'payload invalido', { details: [{ field: 'x' }] });
  httpErr.errors = [{ param: 'x', msg: 'mal' }];
  errorHandler(httpErr, {}, res, () => {});
  assert.equal(payloads[1].code, 422);
  assert.equal(payloads[1].payload.message, 'payload invalido');
  assert.deepEqual(payloads[1].payload.details, [{ field: 'x' }]);
  assert.deepEqual(payloads[1].payload.errors, [{ param: 'x', msg: 'mal' }]);
});
