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

  conversation.metadatos ??= {};
  let updated = false;

  if (participantEntries.length) {
    conversation.metadatos.participants ??= {};
    participantEntries.forEach(([participantId, name]) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }
      if (conversation.metadatos.participants[participantId] !== trimmed) {
        conversation.metadatos.participants[participantId] = trimmed;
        updated = true;
      }
    });
  }

  if (avatarEntries.length) {
    conversation.metadatos.avatars ??= {};
    avatarEntries.forEach(([participantId, path]) => {
      if (conversation.metadatos.avatars[participantId] !== path) {
        conversation.metadatos.avatars[participantId] = path;
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

  const claveParticipantes = buildKey(participants);
  let conversation = await Conversation.findOne({ claveParticipantes });

  if (!conversation) {
    conversation = await Conversation.create({
      participantes: participants,
      metadatos: metadata,
      noLeidos: participants.reduce((acc, participant) => {
        acc.set(String(participant), 0);
        return acc;
      }, new Map()),
      claveParticipantes,
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

const listUserConversations = async (usuarioId) => {
  if (!usuarioId) {
    throw createError(400, 'usuarioId es obligatorio para listar conversaciones');
  }

  const conversations = await Conversation.find({ participantes: usuarioId })
    .sort({ actualizadoEn: -1 })
    .lean();

  return conversations.map((conversation) => ({
    id: conversation._id.toString(),
    participantes: conversation.participantes,
    noLeidos: Conversation.toPlainUnreadCounts(conversation.noLeidos),
    ultimoMensaje: conversation.ultimoMensaje,
    tema: conversation.tema,
    metadatos: conversation.metadatos,
    actualizadoEn: conversation.actualizadoEn,
    creadoEn: conversation.creadoEn,
  }));
};

const ensureParticipant = (conversation, participantId) => {
  if (!conversation.participantes.includes(participantId)) {
    throw createError(403, 'El usuario no pertenece a esta conversacion');
  }
};

const applyMessageEffect = async (conversation, message) => {
  conversation.ultimoMensaje = {
    idMensaje: message._id.toString(),
    contenido: message.contenido,
    enviadoEn: message.enviadoEn,
    remitenteId: message.remitenteId,
  };

  conversation.noLeidos ??= new Map();
  conversation.participantes.forEach((participant) => {
    if (participant === message.remitenteId) {
      conversation.noLeidos.set(participant, 0);
    } else {
      const current = conversation.noLeidos.get(participant) || 0;
      conversation.noLeidos.set(participant, current + 1);
    }
  });

  await conversation.save();
  return conversation;
};

const setUnreadCounter = async (conversation, participantId, value = 0) => {
  conversation.noLeidos ??= new Map();
  ensureParticipant(conversation, participantId);

  conversation.noLeidos.set(participantId, Math.max(0, value));
  await conversation.save();
  return conversation;
};

const decrementUnreadCounter = async (conversation, participantId, delta = 1) => {
  conversation.noLeidos ??= new Map();
  ensureParticipant(conversation, participantId);

  const current = conversation.noLeidos.get(participantId) || 0;
  const nextValue = Math.max(0, current - Math.abs(delta));
  conversation.noLeidos.set(participantId, nextValue);
  await conversation.save();
  return conversation;
};

const deleteConversation = async (conversationId, solicitanteId) => {
  if (!solicitanteId) {
    throw createError(400, 'solicitanteId es obligatorio');
  }

  const conversation = await getConversationOrFail(conversationId);
  ensureParticipant(conversation, solicitanteId);

  await Message.deleteMany({ conversacionId: conversation._id });
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
