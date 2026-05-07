const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Paciente = require('../src/models/pacienteModel');
const PacienteUsuario = require('../src/models/pacienteUsuarioModelo');
const Usuario = require('../src/models/usuarioModel');
const Cita = require('../src/models/citaModel');

const pacientesRouter = require('../src/routes/pacienteRutas');
const pacienteUsuarioRouter = require('../src/routes/pacienteUsuarioRutas');
const citasRouter = require('../src/routes/citasRutas');

const buildTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      idUsuario: '507f1f77bcf86cd799439012',
      rolSistema: 'Administrador'
    };
    next();
  });
  app.use('/api/pacientes', pacientesRouter);
  app.use('/api/pacientes-usuarios', pacienteUsuarioRouter);
  app.use('/api/citas', citasRouter);
  return supertest(app);
};

const createUser = async (index = 1) => {
  return Usuario.create({
    nombreUsuario: `pro${index}`,
    nombre: `Profesional ${index}`,
    apellidos: `Test ${index}`,
    email: `pro${index}@example.com`,
    telefono: `60012345${index}`,
    rol: 'Nutricionista',
    passwordHash: 'hash'
  });
};

const createPaciente = async (index = 1) => {
  const base = {
    nombrePaciente: `Paciente ${index}`,
    apellidos: `Prueba ${index}`,
    fechaNac: new Date(1985, 0, index),
    emailPaciente: `paciente${index}@example.com`,
    telefono: `60000000${index}`
  };
  const res = await Paciente.create(base);
  return res;
};

const isMongoBinaryIssue = (error) =>
  /couldnt find an version from system binary output/i.test(String(error?.message || error));

test('flujo funcional: alta paciente, vinculación, listado mine/all, standby/reactivar, cita completa', async (t) => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  const externalMongoUri = process.env.TEST_MONGO_URI || process.env.MONGO_URI;
  let mongod;
  try {
    mongod = externalMongoUri ? null : await MongoMemoryServer.create();
  } catch (error) {
    if (!process.env.TEST_MONGO_URI && isMongoBinaryIssue(error)) {
      t.skip('MongoMemoryServer no disponible en este entorno; define TEST_MONGO_URI para ejecutar este test.');
      return;
    }
    throw error;
  }
  const uri = externalMongoUri || mongod.getUri();
  await mongoose.connect(uri);

  const request = buildTestApp();

  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  // Alta profesional y paciente
  const profesional = await createUser(1);
  const paciente = await createPaciente(1);

  // Vincular paciente con profesional
  const vinculoRes = await request
    .post('/api/pacientes-usuarios')
    .send({ idPaciente: paciente._id.toString(), idUsuario: profesional._id.toString() })
    .expect(201);
  assert.ok(vinculoRes.body.idPacienteUsuario || vinculoRes.body._id);

  // Listado mine devuelve solo el paciente asignado
  const mineRes = await request
    .get('/api/pacientes')
    .query({ scope: 'mine', idUsuario: profesional._id.toString(), page: 1, limit: 10 })
    .expect(200);
  assert.equal(mineRes.body.total, 1);
  assert.equal(mineRes.body.items.length, 1);
  assert.equal(mineRes.body.items[0].emailPaciente, paciente.emailPaciente);

  // Listado all devuelve el mismo paciente
  const allRes = await request
    .get('/api/pacientes')
    .query({ scope: 'all', page: 1, limit: 10 })
    .expect(200);
  assert.equal(allRes.body.total, 1);

  // Pasar a standby y reactivar
  const standbyRes = await request
    .post(`/api/pacientes/${paciente._id.toString()}/standby`)
    .send({ motivo: 'prueba standby', bajaPor: profesional._id.toString() })
    .expect(200);
  assert.equal(standbyRes.body.paciente.estado, 'standby');

  const reactivarRes = await request
    .post(`/api/pacientes/${paciente._id.toString()}/reactivar`)
    .expect(200);
  assert.equal(reactivarRes.body.paciente.estado, 'activo');

  // Crear cita
  const fechaCita = new Date();
  fechaCita.setHours(10, 0, 0, 0);
  const citaRes = await request
    .post('/api/citas')
    .send({
      fechaCita,
      hora: '10:00',
      tipoConsulta: 'Control',
      notas: 'Primera cita',
      idUsuario: profesional._id.toString(),
      idPaciente: paciente._id.toString()
    })
    .expect(201);
  const citaId = citaRes.body.idCita || citaRes.body._id;
  assert.ok(citaId);
  assert.equal(citaRes.body.estado, 'Pendiente');
  assert.equal(citaRes.body.atendida, false);

  // Actualizar estado a Atendida
  const updateRes = await request
    .patch(`/api/citas/${citaId}`)
    .send({ estado: 'Atendida', notas: 'cerrada' })
    .expect(200);
  assert.equal(updateRes.body.estado, 'Atendida');
  assert.equal(updateRes.body.atendida, true);

  // Listado de citas por profesional incluye la cita con nombre de paciente
  const listRes = await request
    .get('/api/citas')
    .query({ idUsuario: profesional._id.toString() })
    .expect(200);
  assert.equal(listRes.body.length, 1);
  assert.ok(listRes.body[0].paciente.includes('Paciente'));
  assert.equal(listRes.body[0].estado, 'Atendida');

  // Eliminar cita
  await request.delete(`/api/citas/${citaId}`).expect(204);
  // Confirmar que ya no existe
  await request.get(`/api/citas/${citaId}`).expect(404);
});
