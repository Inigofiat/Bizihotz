const { Schema, model } = require('mongoose');

const toPlainUnread = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (Array.isArray(value)) return Object.fromEntries(value);
  if (typeof value === 'object') return value;
  return {};
};

const sessionSchema = new Schema(
  {
    participantes: {
      type: [String],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 2,
        message: 'Una sesion requiere al menos dos participantes',
      },
    },
    claveParticipantes: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tipo: {
      type: String,
      default: 'chatbot',
      index: true,
    },
    titulo: {
      type: String,
      trim: true,
    },
    metadatos: Schema.Types.Mixed,
    ultimoMensaje: {
      idMensaje: String,
      contenido: String,
      enviadoEn: Date,
      remitenteId: String,
      role: String,
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

sessionSchema.pre('validate', function setParticipantKey(next) {
  if (Array.isArray(this.participantes)) {
    const filtered = this.participantes
      .map((p) => String(p).trim())
      .filter(Boolean);
    const unique = [...new Set(filtered)];
    this.participantes = unique;
    this.claveParticipantes = unique.sort().join('#');
  }
  next();
});

sessionSchema.methods.toPublicJSON = function toPublicJSON() {
  const doc = this.toObject({ getters: true });
  return {
    id: doc._id.toString(),
    tipo: doc.tipo,
    participantes: doc.participantes,
    titulo: doc.titulo,
    metadatos: doc.metadatos,
    noLeidos: toPlainUnread(doc.noLeidos),
    ultimoMensaje: doc.ultimoMensaje,
    actualizadoEn: doc.actualizadoEn,
    creadoEn: doc.creadoEn,
  };
};

sessionSchema.statics.toPlainUnread = toPlainUnread;

const Session = model('ChatbotSession', sessionSchema, 'sesiones');

module.exports = Session;
