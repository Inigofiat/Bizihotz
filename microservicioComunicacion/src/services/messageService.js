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

const syncConversationLastMessage = async (conversationId) => {
  if (!conversationId) {
    return null;
  }

  const latest = await Message.findOne({ conversationId }).sort({ sentAt: -1 }).lean();
  if (!latest) {
    await Conversation.updateOne(
      { _id: conversationId },
      { $unset: { lastMessage: '' } }
    );
    return null;
  }

  const snapshot = {
    messageId: latest._id.toString(),
    content: latest.content,
    sentAt: latest.sentAt,
    senderId: latest.senderId,
  };

  await Conversation.updateOne(
    { _id: conversationId },
    { $set: { lastMessage: snapshot } }
  );

  return snapshot;
};

const sanitizeAttachments = (attachments = []) => {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .map((attachment) => ({
      type: attachment.type || 'text',
      url: attachment.url,
      name: attachment.name,
      size: attachment.size,
      metadata: attachment.metadata,
    }))
    .filter((attachment) => attachment.url || attachment.name);
};

const createMessage = async ({ senderId, recipientId, content, attachments, conversationId, metadata }) => {
  if (!senderId || !recipientId) {
    throw createError(400, 'senderId y recipientId son obligatorios');
  }

  if (!content && (!attachments || attachments.length === 0)) {
    throw createError(400, 'El mensaje debe incluir contenido o algun adjunto');
  }

  let conversation;
  if (conversationId) {
    conversation = await getConversationOrFail(conversationId);
    if (
      !conversation.participants.includes(senderId) ||
      !conversation.participants.includes(recipientId)
    ) {
      throw createError(403, 'Los participantes no coinciden con la conversacion solicitada');
    }
  } else {
    conversation = await ensureConversation([senderId, recipientId], metadata);
  }

  const sanitizedAttachments = sanitizeAttachments(attachments);

  const participantMetadata = {
    ...(metadata?.participants || {}),
  };
  participantMetadata[senderId] = participantMetadata[senderId] || metadata?.senderName || senderId;
  participantMetadata[recipientId] =
    participantMetadata[recipientId] || metadata?.recipientName || recipientId;

  const avatarsMetadata = {
    ...(metadata?.avatars || {}),
  };

  const hasMetadataUpdate = mergeParticipantsMetadata(conversation, {
    participants: participantMetadata,
    avatars: avatarsMetadata,
  });

  if (hasMetadataUpdate) {
    await conversation.save();
  }

  const message = await Message.create({
    conversationId: conversation._id,
    senderId,
    recipientId,
    content,
    attachments: sanitizedAttachments,
    metadata,
  });

  await applyMessageEffect(conversation, message);

  return message.toPublicJSON();
};

const editMessageContent = async (messageId, editorId, content) => {
  if (!editorId) {
    throw createError(400, 'editorId es obligatorio para editar mensajes');
  }

  const trimmed = (content || '').trim();
  if (!trimmed) {
    throw createError(400, 'El mensaje editado no puede quedar vacio');
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw createError(404, 'Mensaje no encontrado');
  }

  if (message.senderId !== editorId) {
    throw createError(403, 'Solo el autor del mensaje puede editarlo');
  }

  message.content = trimmed;
  message.editedAt = dayjs().toDate();
  message.editedBy = editorId;
  await message.save();

  await syncConversationLastMessage(message.conversationId);

  return message.toPublicJSON();
};

const deleteMessage = async (messageId, requesterId) => {
  if (!requesterId) {
    throw createError(400, 'requesterId es obligatorio para borrar mensajes');
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw createError(404, 'Mensaje no encontrado');
  }

  if (message.senderId !== requesterId) {
    throw createError(403, 'Solo puedes eliminar tus propios mensajes');
  }

  const conversation = await Conversation.findById(message.conversationId);
  if (!conversation) {
    await Message.deleteOne({ _id: messageId });
    return {
      id: messageId,
      conversationId: message.conversationId.toString(),
      senderId: message.senderId,
      recipientId: message.recipientId,
      deletedBy: requesterId,
    };
  }

  if (!conversation.participants.includes(requesterId)) {
    throw createError(403, 'No perteneces a esta conversacion');
  }

  await Message.deleteOne({ _id: messageId });

  if (!message.readAt && message.recipientId) {
    const unreadCounts = Conversation.toPlainUnreadCounts(conversation.unreadCounts);
    if (typeof unreadCounts[message.recipientId] === 'number') {
      unreadCounts[message.recipientId] = Math.max(0, unreadCounts[message.recipientId] - 1);
      await Conversation.updateOne(
        { _id: conversation._id },
        { $set: { unreadCounts } }
      );
    }
  }

  await syncConversationLastMessage(conversation._id);

  return {
    id: messageId,
    conversationId: conversation._id.toString(),
    senderId: message.senderId,
    recipientId: message.recipientId,
    deletedBy: requesterId,
  };
};

const getMessagesByConversation = async (conversationId, { page = 1, limit, order = 'asc' } = {}) => {
  const conversation = await getConversationOrFail(conversationId);
  const safeLimit = Math.min(Number(limit) || config.defaultPageSize, config.maxPageSize);
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;
  const safeOrder = order === 'desc' ? -1 : 1;

  const [messages, total] = await Promise.all([
    Message.find({ conversationId: conversation._id })
      .sort({ sentAt: safeOrder })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Message.countDocuments({ conversationId: conversation._id }),
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
      conversationId: message.conversationId.toString(),
      senderId: message.senderId,
      recipientId: message.recipientId,
      content: message.content,
      attachments: message.attachments,
      metadata: message.metadata,
      status: message.status,
      readAt: message.readAt,
      sentAt: message.sentAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    })),
  };
};

const markMessageAsRead = async (messageId, readerId) => {
  if (!readerId) {
    throw createError(400, 'readerId es obligatorio para marcar como leido');
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw createError(404, 'Mensaje no encontrado');
  }

  if (message.recipientId !== readerId) {
    throw createError(403, 'Solo el destinatario puede marcar el mensaje como leido');
  }

  if (!message.readAt) {
    message.readAt = dayjs().toDate();
    message.status = 'read';
    await message.save();

    const conversation = await Conversation.findById(message.conversationId);
    if (conversation) {
      await decrementUnreadCounter(conversation, readerId, 1);
    }
  }

  return message.toPublicJSON();
};

const markConversationAsRead = async (conversationId, readerId) => {
  if (!readerId) {
    throw createError(400, 'readerId es obligatorio');
  }

  const conversation = await getConversationOrFail(conversationId);
  if (!conversation.participants.includes(readerId)) {
    throw createError(403, 'El usuario no pertenece a la conversacion');
  }

  const now = dayjs().toDate();
  await Message.updateMany(
    { conversationId, recipientId: readerId, readAt: null },
    { $set: { readAt: now, status: 'read' } }
  );
  await setUnreadCounter(conversation, readerId, 0);

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
