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
    participants: {
      type: [String],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 2,
        message: 'Una conversacion requiere al menos dos participantes',
      },
    },
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    topic: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    lastMessage: {
      messageId: String,
      content: String,
      sentAt: Date,
      senderId: String,
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

conversationSchema.pre('validate', function setParticipantKey(next) {
  if (Array.isArray(this.participants)) {
    const filtered = this.participants
      .map((participant) => String(participant).trim())
      .filter(Boolean);

    const unique = [...new Set(filtered)];
    this.participants = unique;
    this.participantKey = unique.sort().join('#');
  }

  next();
});

conversationSchema.methods.toPublicJSON = function toPublicJSON() {
  const doc = this.toObject({ getters: true });
  return {
    id: doc._id.toString(),
    participants: doc.participants,
    unreadCounts: toPlainUnreadCounts(doc.unreadCounts),
    lastMessage: doc.lastMessage,
    topic: doc.topic,
    metadata: doc.metadata,
    updatedAt: doc.updatedAt,
    createdAt: doc.createdAt,
  };
};

conversationSchema.statics.toPlainUnreadCounts = toPlainUnreadCounts;

const Conversation = model('Conversation', conversationSchema);

module.exports = Conversation;
