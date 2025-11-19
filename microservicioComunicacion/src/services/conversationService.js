const createError = require('http-errors');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const buildKey = (participants) =>
  participants
    .map((participant) => String(participant).trim())
    .filter(Boolean)
    .sort()
    .join('#');

const mergeParticipantsMetadata = (conversation, metadata = {}) => {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  const participantEntries = Object.entries(metadata.participants || {}).filter(
    ([key, value]) => key && value && typeof value === 'string'
  );
  const avatarEntries = Object.entries(metadata.avatars || {}).filter(
    ([key, value]) => key && typeof value === 'string' && value.trim() !== ''
  );

  if (participantEntries.length === 0 && avatarEntries.length === 0) {
    return false;
  }

  conversation.metadata ??= {};
  let updated = false;

  if (participantEntries.length) {
    conversation.metadata.participants ??= {};
    participantEntries.forEach(([participantId, name]) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }
      if (conversation.metadata.participants[participantId] !== trimmed) {
        conversation.metadata.participants[participantId] = trimmed;
        updated = true;
      }
    });
  }

  if (avatarEntries.length) {
    conversation.metadata.avatars ??= {};
    avatarEntries.forEach(([participantId, path]) => {
      if (conversation.metadata.avatars[participantId] !== path) {
        conversation.metadata.avatars[participantId] = path;
        updated = true;
      }
    });
  }

  return updated;
};

const ensureConversation = async (participants, metadata = {}) => {
  if (!Array.isArray(participants) || participants.length < 2) {
    throw createError(400, 'Se requieren al menos dos participantes para iniciar una conversacion');
  }

  const participantKey = buildKey(participants);
  let conversation = await Conversation.findOne({ participantKey });

  if (!conversation) {
    conversation = await Conversation.create({
      participants,
      metadata,
      unreadCounts: participants.reduce((acc, participant) => {
        acc.set(String(participant), 0);
        return acc;
      }, new Map()),
    });
  }

  if (metadata && mergeParticipantsMetadata(conversation, metadata)) {
    await conversation.save();
  }

  return conversation;
};

const getConversationOrFail = async (conversationId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw createError(404, 'Conversacion no encontrada');
  }
  return conversation;
};

const listUserConversations = async (userId) => {
  if (!userId) {
    throw createError(400, 'userId es obligatorio para listar conversaciones');
  }

  const conversations = await Conversation.find({ participants: userId })
    .sort({ updatedAt: -1 })
    .lean();

  return conversations.map((conversation) => ({
    id: conversation._id.toString(),
    participants: conversation.participants,
    unreadCounts: Conversation.toPlainUnreadCounts(conversation.unreadCounts),
    lastMessage: conversation.lastMessage,
    topic: conversation.topic,
    metadata: conversation.metadata,
    updatedAt: conversation.updatedAt,
    createdAt: conversation.createdAt,
  }));
};

const ensureParticipant = (conversation, participantId) => {
  if (!conversation.participants.includes(participantId)) {
    throw createError(403, 'El usuario no pertenece a esta conversacion');
  }
};

const applyMessageEffect = async (conversation, message) => {
  conversation.lastMessage = {
    messageId: message._id.toString(),
    content: message.content,
    sentAt: message.sentAt,
    senderId: message.senderId,
  };

  conversation.unreadCounts ??= new Map();
  conversation.participants.forEach((participant) => {
    if (participant === message.senderId) {
      conversation.unreadCounts.set(participant, 0);
    } else {
      const current = conversation.unreadCounts.get(participant) || 0;
      conversation.unreadCounts.set(participant, current + 1);
    }
  });

  await conversation.save();
  return conversation;
};

const setUnreadCounter = async (conversation, participantId, value = 0) => {
  conversation.unreadCounts ??= new Map();
  ensureParticipant(conversation, participantId);

  conversation.unreadCounts.set(participantId, Math.max(0, value));
  await conversation.save();
  return conversation;
};

const decrementUnreadCounter = async (conversation, participantId, delta = 1) => {
  conversation.unreadCounts ??= new Map();
  ensureParticipant(conversation, participantId);

  const current = conversation.unreadCounts.get(participantId) || 0;
  const nextValue = Math.max(0, current - Math.abs(delta));
  conversation.unreadCounts.set(participantId, nextValue);
  await conversation.save();
  return conversation;
};

const deleteConversation = async (conversationId, requesterId) => {
  if (!requesterId) {
    throw createError(400, 'requesterId es obligatorio');
  }

  const conversation = await getConversationOrFail(conversationId);
  ensureParticipant(conversation, requesterId);

  await Message.deleteMany({ conversationId: conversation._id });
  await conversation.deleteOne();

  return conversation.toPublicJSON();
};

module.exports = {
  ensureConversation,
  getConversationOrFail,
  listUserConversations,
  applyMessageEffect,
  setUnreadCounter,
  decrementUnreadCounter,
  mergeParticipantsMetadata,
  deleteConversation,
};
