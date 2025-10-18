"use strict";

const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema(
  {
    nombreUsuario: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    telefono: { type: String, default: "", trim: true },
    rol: { type: String, required: true, default: "profesional", trim: true },
    foto: { type: String, default: "" },
    passwordHash: { type: String, required: true },
    activo: { type: Boolean, default: true },
    debeActualizarPassword: { type: Boolean, default: false },
    ultimoCambioPassword: { type: Date, default: null }
  },
  { timestamps: true }
);

usuarioSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.idUsuario = ret._id;
    delete ret._id;
    delete ret.passwordHash;
  }
});

module.exports = mongoose.model("Usuario", usuarioSchema);
