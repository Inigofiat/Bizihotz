"use strict";

const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env")
});

const collectionRenames = [
  ["citas", "Cita"],
  ["historialpacientes", "HistorialPaciente"],
  ["pacientes", "Paciente"],
  ["pacienteusuarios", "PacienteUsuario"],
  ["registroantropomtricos", "RegistroAntropometrico"],
  ["registroantropometricos", "RegistroAntropometrico"],
  ["usuarios", "Usuario"]
];

const usuarioFieldRenames = [
  ["passwordHash", "contraseniaHash"],
  ["debeActualizarPassword", "debeActualizarCont"],
  ["ultimoCambioPassword", "ultimoCambioCont"],
  ["createdAt", "creadoEn"],
  ["creado_en", "creadoEn"],
  ["updatedAt", "acutalizadoEn"],
  ["actualizado_en", "acutalizadoEn"]
];

const collectionExists = async (db, name) => {
  const items = await db.listCollections({ name }).toArray();
  return items.length > 0;
};

const renameCollectionIfSafe = async (db, from, to) => {
  const sourceExists = await collectionExists(db, from);
  if (!sourceExists) {
    console.log(`[skip] Coleccion origen no existe: ${from}`);
    return;
  }

  const targetExists = await collectionExists(db, to);
  if (targetExists) {
    console.warn(`[skip] Ya existe ${to}; no se renombra ${from} para no sobrescribir datos.`);
    return;
  }

  await db.collection(from).rename(to, { dropTarget: false });
  console.log(`[ok] Coleccion ${from} -> ${to}`);
};

const renameFieldIfSafe = async (collection, from, to) => {
  const filter = {
    [from]: { $exists: true },
    [to]: { $exists: false }
  };
  const result = await collection.updateMany(filter, { $rename: { [from]: to } });
  console.log(`[ok] ${collection.collectionName}.${from} -> ${to}: ${result.modifiedCount}`);

  const conflicts = await collection.countDocuments({
    [from]: { $exists: true },
    [to]: { $exists: true }
  });
  if (conflicts > 0) {
    console.warn(
      `[warn] ${collection.collectionName}: ${conflicts} documentos tienen ${from} y ${to}; revisar manualmente.`
    );
  }
};

const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI no esta definido.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  for (const [from, to] of collectionRenames) {
    await renameCollectionIfSafe(db, from, to);
  }

  if (await collectionExists(db, "Usuario")) {
    const usuarios = db.collection("Usuario");
    for (const [from, to] of usuarioFieldRenames) {
      await renameFieldIfSafe(usuarios, from, to);
    }
  } else {
    console.warn("[skip] No existe la coleccion Usuario para renombrar campos.");
  }
};

main()
  .catch((error) => {
    console.error("[error] Migracion de nombres en gestion fallida:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
