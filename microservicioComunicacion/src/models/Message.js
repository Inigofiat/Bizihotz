const { Schema, model } = require('mongoose');

const attachmentSchema = new Schema(
  {
    tipo: {
      type: String,
      enum: ['text', 'image', 'file', 'link', 'other'],
      default: 'text',
    },
    url: {
      type: String,
      trim: true,
    },
    nombre: {
      type: String,
      trim: true,
    },
    tamano: Number,
    metadatos: Schema.Types.Mixed,
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    conversacionId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversacion',
      required: true,
      index: true,
    },
    remitenteId: {
      type: String,
      required: true,
      index: true,
    },
    destinatarioId: {
      type: String,
      required: true,
      index: true,
    },
    contenido: {
      type: String,
      trim: true,
      default: '',
      maxlength: 5000,
    },
    adjuntos: [attachmentSchema],
    estado: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    leidoEn: {
      type: Date,
      default: null,
    },
    editadoEn: {
      type: Date,
      default: null,
    },
    editadoPor: {
      type: String,
      default: null,
      trim: true,
    },
    metadatos: Schema.Types.Mixed,
    enviadoEn: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
    versionKey: false,
  }
);

messageSchema.index({ remitenteId: 1, destinatarioId: 1, enviadoEn: -1 });

messageSchema.methods.toPublicJSON = function toPublicJSON() {
  const doc = this.toObject({ getters: true });
  return {
    id: doc._id.toString(),
    conversacionId: doc.conversacionId?.toString(),
    remitenteId: doc.remitenteId,
    destinatarioId: doc.destinatarioId,
    contenido: doc.contenido,
    adjuntos: doc.adjuntos,
    metadatos: doc.metadatos || null,
    estado: doc.estado,
    leidoEn: doc.leidoEn,
    editadoEn: doc.editadoEn,
    editadoPor: doc.editadoPor,
    enviadoEn: doc.enviadoEn,
    creadoEn: doc.creadoEn,
    actualizadoEn: doc.actualizadoEn,
  };
};

// Forzamos el nombre de coleccion a "Mensaje" en Mongo.
const Message = model('Mensaje', messageSchema, 'Mensaje');

module.exports = Message;
