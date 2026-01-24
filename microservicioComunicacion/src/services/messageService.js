const createError = require('http-errors');
const dayjs = require('dayjs');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const config = require('../config/env');
const {
  ensureConversation,
  getConversationOrFail,
  applyMessageEffect,
  setUnreadCounter,
  decrementUnreadCounter,
  mergeParticipantsMetadata,
} = require('./conversationService');

const syncConversationLastMessage = async (conversacionId) => {
  if (!conversacionId) {
    return null;
  }

  const latest = await Message.findOne({ conversacionId }).sort({ enviadoEn: -1 }).lean();
  if (!latest) {
    await Conversation.updateOne(
      { _id: conversacionId },
      { $unset: { ultimoMensaje: '' } }
    );
    return null;
  }

  const snapshot = {
    idMensaje: latest._id.toString(),
    contenido: latest.contenido,
    enviadoEn: latest.enviadoEn,
    remitenteId: latest.remitenteId,
    adjuntos: latest.adjuntos || [],
  };

  await Conversation.updateOne(
    { _id: conversacionId },
    { $set: { ultimoMensaje: snapshot } }
  );

  return snapshot;
};

const sanitizeAttachments = (adjuntos = []) => {
  if (!Array.isArray(adjuntos)) {
    return [];
  }

  return adjuntos
    .map((attachment) => ({
      tipo: attachment.tipo || attachment.type || 'text',
      url: attachment.url,
      nombre: attachment.nombre ?? attachment.name,
      tamano: attachment.tamano ?? attachment.size,
      metadatos: attachment.metadatos ?? attachment.metadata,
    }))
    .filter((attachment) => attachment.url || attachment.nombre);
};

const createMessage = async ({
  remitenteId,
  destinatarioId,
  contenido,
  adjuntos,
  conversacionId,
  metadatos,
}) => {
  if (!remitenteId || !destinatarioId) {
    throw createError(400, 'remitenteId y destinatarioId son obligatorios');
  }

  if (!contenido && (!adjuntos || adjuntos.length === 0)) {
    throw createError(400, 'El mensaje debe incluir contenido o algun adjunto');
  }

  let conversation;
  if (conversacionId) {
    conversation = await getConversationOrFail(conversacionId);
    if (
      !conversation.participantes.includes(remitenteId) ||
      !conversation.participantes.includes(destinatarioId)
    ) {
      throw createError(403, 'Los participantes no coinciden con la conversacion solicitada');
    }
  } else {
    conversation = await ensureConversation([remitenteId, destinatarioId], metadatos);
  }

  const sanitizedAttachments = sanitizeAttachments(adjuntos);

  const participantMetadata = {
    ...(metadatos?.participants || metadatos?.participantes || {}),
  };
  participantMetadata[remitenteId] =
    participantMetadata[remitenteId] || metadatos?.senderName || metadatos?.remitenteNombre || remitenteId;
  participantMetadata[destinatarioId] =
    participantMetadata[destinatarioId] ||
    metadatos?.recipientName ||
    metadatos?.destinatarioNombre ||
    destinatarioId;

  const avatarsMetadata = {
    ...(metadatos?.avatars || metadatos?.avatares || {}),
  };

  const hasMetadataUpdate = mergeParticipantsMetadata(conversation, {
    participants: participantMetadata,
    avatars: avatarsMetadata,
  });

  if (hasMetadataUpdate) {
    await conversation.save();
  }

  const message = await Message.create({
    conversacionId: conversation._id,
    remitenteId,
    destinatarioId,
    contenido,
    adjuntos: sanitizedAttachments,
    metadatos,
  });

  await applyMessageEffect(conversation, message);

  return message.toPublicJSON();
};

const editMessageContent = async (messageId, editorId, contenido) => {
  if (!editorId) {
    throw createError(400, 'editorId es obligatorio para editar mensajes');
  }

  const trimmed = (contenido || '').trim();
  if (!trimmed) {
    throw createError(400, 'El mensaje editado no puede quedar vacio');
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw createError(404, 'Mensaje no encontrado');
  }

  if (message.remitenteId !== editorId) {
    throw createError(403, 'Solo el autor del mensaje puede editarlo');
  }

  message.contenido = trimmed;
  message.editadoEn = dayjs().toDate();
  message.editadoPor = editorId;
  await message.save();

  await syncConversationLastMessage(message.conversacionId);

  return message.toPublicJSON();
};

const deleteMessage = async (messageId, solicitanteId) => {
  if (!solicitanteId) {
    throw createError(400, 'solicitanteId es obligatorio para borrar mensajes');
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw createError(404, 'Mensaje no encontrado');
  }

  if (message.remitenteId !== solicitanteId) {
    throw createError(403, 'Solo puedes eliminar tus propios mensajes');
  }

  const conversation = await Conversation.findById(message.conversacionId);
  if (!conversation) {
    await Message.deleteOne({ _id: messageId });
    return {
      id: messageId,
      conversacionId: message.conversacionId.toString(),
      remitenteId: message.remitenteId,
      destinatarioId: message.destinatarioId,
      deletedBy: solicitanteId,
    };
  }

  if (!conversation.participantes.includes(solicitanteId)) {
    throw createError(403, 'No perteneces a esta conversacion');
  }

  await Message.deleteOne({ _id: messageId });

  if (!message.leidoEn && message.destinatarioId) {
    const unreadCounts = Conversation.toPlainUnreadCounts(conversation.noLeidos);
    if (typeof unreadCounts[message.destinatarioId] === 'number') {
      unreadCounts[message.destinatarioId] = Math.max(0, unreadCounts[message.destinatarioId] - 1);
      await Conversation.updateOne(
        { _id: conversation._id },
        { $set: { noLeidos: unreadCounts } }
      );
    }
  }

  await syncConversationLastMessage(conversation._id);

  return {
    id: messageId,
    conversacionId: conversation._id.toString(),
    remitenteId: message.remitenteId,
    destinatarioId: message.destinatarioId,
    deletedBy: solicitanteId,
  };
};

const getMessagesByConversation = async (conversationId, { page = 1, limit, order = 'asc' } = {}) => {
  const conversation = await getConversationOrFail(conversationId);
  const safeLimit = Math.min(Number(limit) || config.defaultPageSize, config.maxPageSize);
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;
  const safeOrder = order === 'desc' ? -1 : 1;

  const [messages, total] = await Promise.all([
    Message.find({ conversacionId: conversation._id })
      .sort({ enviadoEn: safeOrder })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Message.countDocuments({ conversacionId: conversation._id }),
  ]);

  return {
    conversation: conversation.toPublicJSON(),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: safePage * safeLimit < total,
    },
    items: messages.map((message) => ({
      id: message._id.toString(),
      conversacionId: message.conversacionId.toString(),
      remitenteId: message.remitenteId,
      destinatarioId: message.destinatarioId,
      contenido: message.contenido,
      adjuntos: message.adjuntos,
      metadatos: message.metadatos,
      estado: message.estado,
      leidoEn: message.leidoEn,
      enviadoEn: message.enviadoEn,
      creadoEn: message.creadoEn,
      actualizadoEn: message.actualizadoEn,
    })),
  };
};

const markMessageAsRead = async (messageId, lectorId) => {
  if (!lectorId) {
    throw createError(400, 'lectorId es obligatorio para marcar como leido');
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw createError(404, 'Mensaje no encontrado');
  }

  if (message.destinatarioId !== lectorId) {
    throw createError(403, 'Solo el destinatario puede marcar el mensaje como leido');
  }

  if (!message.leidoEn) {
    message.leidoEn = dayjs().toDate();
    message.estado = 'read';
    await message.save();

    const conversation = await Conversation.findById(message.conversacionId);
    if (conversation) {
      await decrementUnreadCounter(conversation, lectorId, 1);
    }
  }

  return message.toPublicJSON();
};

const markConversationAsRead = async (conversationId, lectorId) => {
  if (!lectorId) {
    throw createError(400, 'lectorId es obligatorio');
  }

  const conversation = await getConversationOrFail(conversationId);
  if (!conversation.participantes.includes(lectorId)) {
    throw createError(403, 'El usuario no pertenece a la conversacion');
  }

  const now = dayjs().toDate();
  await Message.updateMany(
    { conversacionId: conversationId, destinatarioId: lectorId, leidoEn: null },
    { $set: { leidoEn: now, estado: 'read' } }
  );
  await setUnreadCounter(conversation, lectorId, 0);

  return conversation.toPublicJSON();
};

module.exports = {
  createMessage,
  getMessagesByConversation,
  markMessageAsRead,
  markConversationAsRead,
  editMessageContent,
  deleteMessage,
};
