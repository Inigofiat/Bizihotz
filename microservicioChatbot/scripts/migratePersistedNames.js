"use strict";

const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env")
});

const collectionExists = async (db, name) => {
  const items = await db.listCollections({ name }).toArray();
  return items.length > 0;
};

const renameFieldIfSafe = async (collection, from, to) => {
  const result = await collection.updateMany(
    {
      [from]: { $exists: true },
      [to]: { $exists: false }
    },
    { $rename: { [from]: to } }
  );
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
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatbot";
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  if (!(await collectionExists(db, "MensajesChatbot"))) {
    console.warn("[skip] No existe la coleccion MensajesChatbot.");
    return;
  }

  await renameFieldIfSafe(db.collection("MensajesChatbot"), "role", "rol");
};

main()
  .catch((error) => {
    console.error("[error] Migracion de nombres en chatbot fallida:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
