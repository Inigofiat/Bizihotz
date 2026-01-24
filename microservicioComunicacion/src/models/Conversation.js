const { Schema, model } = require('mongoose');

const toPlainUnreadCounts = (value) => {
  if (!value) {
    return {};
  }
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  if (Array.isArray(value)) {
    return Object.fromEntries(value);
  }
  if (typeof value === 'object') {
    return value;
  }
  return {};
};

const conversationSchema = new Schema(
  {
    participantes: {
      type: [String],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 2,
        message: 'Una conversacion requiere al menos dos participantes',
      },
    },
    claveParticipantes: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tema: {
      type: String,
      trim: true,
    },
    metadatos: {
      type: Schema.Types.Mixed,
    },
    ultimoMensaje: {
      idMensaje: String,
      contenido: String,
      enviadoEn: Date,
      remitenteId: String,
      adjuntos: [
        {
          tipo: String,
          url: String,
          nombre: String,
          tamano: Number,
          metadatos: Schema.Types.Mixed,
        },
      ],
    },
    noLeidos: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
    versionKey: false,
  }
);

conversationSchema.pre('validate', function setParticipantKey(next) {
  if (Array.isArray(this.participantes)) {
    const filtered = this.participantes
      .map((participant) => String(participant).trim())
      .filter(Boolean);

    const unique = [...new Set(filtered)];
    this.participantes = unique;
    this.claveParticipantes = unique.sort().join('#');
  }

  next();
});

conversationSchema.methods.toPublicJSON = function toPublicJSON() {
  const doc = this.toObject({ getters: true });
  return {
    id: doc._id.toString(),
    participantes: doc.participantes,
    noLeidos: toPlainUnreadCounts(doc.noLeidos),
    ultimoMensaje: doc.ultimoMensaje,
    tema: doc.tema,
    metadatos: doc.metadatos,
    actualizadoEn: doc.actualizadoEn,
    creadoEn: doc.creadoEn,
  };
};

conversationSchema.statics.toPlainUnreadCounts = toPlainUnreadCounts;

// Forzamos el nombre de coleccion a "Conversacion" en Mongo.
const Conversacion = model('Conversacion', conversationSchema, 'Conversacion');

module.exports = Conversacion;
