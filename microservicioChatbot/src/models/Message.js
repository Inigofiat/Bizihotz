const { Schema, model } = require('mongoose');

const messageSchema = new Schema(
  {
    sesionId: {
      type: Schema.Types.ObjectId,
      ref: 'SesionesChatbot',
      required: true,
      index: true,
    },
    remitenteId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      default: 'user',
    },
    contenido: {
      type: String,
      trim: true,
      default: '',
      maxlength: 5000,
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

messageSchema.index({ remitenteId: 1, enviadoEn: -1 });

messageSchema.methods.toPublicJSON = function toPublicJSON() {
  const doc = this.toObject({ getters: true });
  return {
    id: doc._id.toString(),
    sesionId: doc.sesionId?.toString(),
    remitenteId: doc.remitenteId,
    role: doc.role,
    contenido: doc.contenido,
    metadatos: doc.metadatos || null,
    enviadoEn: doc.enviadoEn,
    creadoEn: doc.creadoEn,
    actualizadoEn: doc.actualizadoEn,
  };
};

const Message = model('MensajesChatbot', messageSchema, 'MensajesChatbot');

module.exports = Message;
