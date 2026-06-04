"use strict";

const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema(
  {
    nombreUsuario: { type: String, required: true, trim: true },
    nombre: { type: String, default: "", trim: true },
    apellidos: { type: String, default: "", trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    telefono: { type: String, default: "", trim: true },
    rol: { type: String, required: true, default: "Nutricionista", trim: true },
    // Perfil de acceso (RBAC). Separado del rol profesional/área.
    rolSistema: {
      type: String,
      enum: ["Profesional del centro", "Administrador", "Recepcionista"],
      default: "Profesional del centro",
      trim: true
    },
    foto: { type: String, default: "" },
    contraseniaHash: { type: String, required: true },
    passwordHash: { type: String, select: false },
    activo: { type: Boolean, default: true },
    debeActualizarCont: { type: Boolean, default: false },
    debeActualizarPassword: { type: Boolean, select: false },
    ultimoCambioCont: { type: Date, default: null },
    ultimoCambioPassword: { type: Date, select: false },
    ultimoAcceso: { type: Date, default: null }
  },
  { timestamps: { createdAt: "creadoEn", updatedAt: "acutalizadoEn" } }
);

usuarioSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.idUsuario = ret._id;
    delete ret._id;
    delete ret.contraseniaHash;
    delete ret.passwordHash;
    // Aseguramos que los documentos antiguos sin rolSistema sigan funcionando como "Profesional del centro".
    if (!ret.rolSistema) {
      ret.rolSistema = "Profesional del centro";
    }
  }
});

module.exports = mongoose.model("Usuario", usuarioSchema, "Usuario");
