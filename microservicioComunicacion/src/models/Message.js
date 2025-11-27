const { Schema, model } = require('mongoose');

const attachmentSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'link', 'other'],
      default: 'text',
    },
    url: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    size: Number,
    metadata: Schema.Types.Mixed,
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
      index: true,
    },
    recipientId: {
      type: String,
      required: true,
      index: true,
    },
    content: {
      type: String,
      trim: true,
      default: '',
      maxlength: 5000,
    },
    attachments: [attachmentSchema],
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    readAt: {
      type: Date,
      default: null,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    editedBy: {
      type: String,
      default: null,
      trim: true,
    },
    metadata: Schema.Types.Mixed,
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

messageSchema.index({ senderId: 1, recipientId: 1, sentAt: -1 });

messageSchema.methods.toPublicJSON = function toPublicJSON() {
  const doc = this.toObject({ getters: true });
  return {
    id: doc._id.toString(),
    conversationId: doc.conversationId?.toString(),
    senderId: doc.senderId,
    recipientId: doc.recipientId,
    content: doc.content,
    attachments: doc.attachments,
    metadata: doc.metadata || null,
    status: doc.status,
    readAt: doc.readAt,
    editedAt: doc.editedAt,
    editedBy: doc.editedBy,
    sentAt: doc.sentAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const Message = model('Message', messageSchema);

module.exports = Message;
