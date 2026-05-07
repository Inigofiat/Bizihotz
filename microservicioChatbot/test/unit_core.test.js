const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const supertest = require('supertest');
const { body } = require('express-validator');
const createError = require('http-errors');

const asyncHandler = require('../src/utils/asyncHandler');
const validateRequest = require('../src/middlewares/validateRequest');
const errorHandler = require('../src/middlewares/errorHandler');

process.env.NODE_ENV = 'test';

test('asyncHandler propaga excepciones via next', async () => {
  const expected = new Error('boom');
  let captured;
  const fn = asyncHandler(async () => {
    throw expected;
  });
  await fn({}, {}, (err) => {
    captured = err;
  });
  assert.equal(captured, expected);
});

test('validateRequest en chatbot responde 400 cuando hay errores', async () => {
  const app = express();
  app.use(express.json());
  app.post(
    '/val',
    [body('titulo').isLength({ min: 3 }).withMessage('titulo invalido')],
    validateRequest,
    (_req, res) => res.json({ ok: true })
  );
  app.use(errorHandler);

  const bad = await supertest(app).post('/val').send({ titulo: 'ab' }).expect(400);
  assert.match(bad.body.mensaje || '', /titulo invalido/i);

  const good = await supertest(app).post('/val').send({ titulo: 'abcd' }).expect(200);
  assert.equal(good.body.ok, true);
});

test('errorHandler en chatbot normaliza errores http y 500', () => {
  const outputs = [];
  const res = {
    status(code) {
      this.code = code;
      return this;
    },
    json(payload) {
      outputs.push({ code: this.code, payload });
      return this;
    },
  };

  const httpErr = createError(403, 'forbidden');
  errorHandler(httpErr, {}, res, () => {});
  assert.equal(outputs[0].code, 403);
  assert.equal(outputs[0].payload.mensaje, 'forbidden');

  errorHandler(new Error('interno'), {}, res, () => {});
  assert.equal(outputs[1].code, 500);
  assert.match(outputs[1].payload.mensaje, /interno/i);
  assert.ok(outputs[1].payload.stack);
});

