const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Paciente = require('../src/models/pacienteModel');
const PacienteUsuario = require('../src/models/pacienteUsuarioModelo');
const pacientesRouter = require('../src/routes/pacienteRutas');

const buildPacientePayload = (index = 1) => ({
  nombrePaciente: `Paciente ${index}`,
  apellidos: `Prueba ${index}`,
  fechaNac: new Date(1990, 0, index),
  emailPaciente: `paciente${index}@example.com`,
  telefono: `60000000${index}`
});

const setupTestApp = async (t) => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  const app = express();
  app.use(express.json());
  app.use('/api/pacientes', pacientesRouter);
  const request = supertest(app);

  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
  });

  return { request };
};

const seedPacientes = async (userMine, otherUser) => {
  const p1 = await Paciente.create(buildPacientePayload(1));
  const p2 = await Paciente.create(buildPacientePayload(2));
  const p3 = await Paciente.create(buildPacientePayload(3));

  await PacienteUsuario.create([
    { idUsuario: userMine, idPaciente: p1._id },
    { idUsuario: userMine, idPaciente: p2._id },
    { idUsuario: otherUser, idPaciente: p3._id }
  ]);

  return { p1, p2, p3 };
};

test('GET /api/pacientes con scope=mine devuelve solo pacientes asignados', async (t) => {
  const { request } = await setupTestApp(t);
  const userMine = new mongoose.Types.ObjectId();
  const otherUser = new mongoose.Types.ObjectId();
  const { p1, p2 } = await seedPacientes(userMine, otherUser);

  const res = await request
    .get('/api/pacientes')
    .query({ scope: 'mine', idUsuario: userMine.toString(), page: 1, limit: 10 })
    .expect(200);

  assert.equal(res.body.total, 2);
  assert.equal(res.body.items.length, 2);
  const returnedIds = res.body.items.map((p) => p.idPaciente || p._id.toString());
  assert.deepEqual(new Set(returnedIds), new Set([p1._id.toString(), p2._id.toString()]));
});

test('GET /api/pacientes con scope=all devuelve todos los pacientes', async (t) => {
  const { request } = await setupTestApp(t);
  const userMine = new mongoose.Types.ObjectId();
  const otherUser = new mongoose.Types.ObjectId();
  await seedPacientes(userMine, otherUser);

  const res = await request
    .get('/api/pacientes')
    .query({ scope: 'all', page: 1, limit: 10 })
    .expect(200);

  assert.equal(res.body.total, 3);
  assert.equal(res.body.items.length, 3);
});
