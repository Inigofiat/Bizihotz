const test = require('node:test');
const assert = require('node:assert/strict');

const { createNotFoundError } = require('../src/utils/httpErrors');
const { ensureValidObjectId } = require('../src/utils/validators');
const {
  ESTADO_ERROR_MESSAGE,
  coerceEstado,
  ensureEstadoValido,
  deriveEstadoDesdeAtendida
} = require('../src/utils/estadoCita');

test('createNotFoundError construye error 404 con id', () => {
  const error = createNotFoundError('Cita', 'abc123');
  assert.equal(error.status, 404);
  assert.equal(error.message, 'Cita con identificador abc123 no encontrado.');
});

test('ensureValidObjectId acepta ObjectId valido', () => {
  const id = '507f1f77bcf86cd799439011';
  assert.equal(ensureValidObjectId(id, 'paciente'), id);
});

test('ensureValidObjectId rechaza ObjectId invalido', () => {
  assert.throws(
    () => ensureValidObjectId('no-es-id', 'usuario'),
    (error) => error.status === 400 && /usuario/i.test(error.message)
  );
});

test('coerceEstado normaliza texto y deriveEstadoDesdeAtendida prioriza estado actual valido', () => {
  const estado = coerceEstado('  cancelada ');
  assert.equal(estado.estado, 'Cancelada');
  assert.equal(estado.atendida, false);
  assert.equal(deriveEstadoDesdeAtendida(true, 'cancelada'), 'Cancelada');
});

test('ensureEstadoValido lanza error 400 cuando estado es invalido', () => {
  assert.throws(
    () => ensureEstadoValido('desconocido'),
    (error) => error.status === 400 && error.message === ESTADO_ERROR_MESSAGE
  );
});
