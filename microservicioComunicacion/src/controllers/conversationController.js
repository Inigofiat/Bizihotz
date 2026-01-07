const asyncHandler = require('../utils/asyncHandler');
const conversationService = require('../services/conversationService');
const {
  getMessagesByConversation,
  markConversationAsRead,
} = require('../services/messageService');
const { emitToUsers } = require('../utils/socketEmitter');

const createConversation = asyncHandler(async (req, res) => {
  const solicitanteId = req.body.solicitanteId || req.body.requesterId;
  const participanteId = req.body.participanteId || req.body.participantId;
  const metadatos = req.body.metadatos || req.body.metadata;
  const conversation = await conversationService.ensureConversation(
    [solicitanteId, participanteId],
    metadatos
  );
  return res.status(201).json({ data: conversation.toPublicJSON() });
});

const listConversations = asyncHandler(async (req, res) => {
  const usuarioId = req.query.usuarioId || req.query.userId;
  const conversations = await conversationService.listUserConversations(usuarioId);
  return res.json({ data: conversations });
});

const fetchConversationMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { page, limit, order } = req.query;
  const result = await getMessagesByConversation(conversationId, { page, limit, order });
  return res.json(result);
});

const markConversationRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const lectorId = req.body.lectorId || req.body.readerId;
  const conversation = await markConversationAsRead(conversationId, lectorId);
  return res.json({ data: conversation });
});

const removeConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const solicitanteId = req.body.solicitanteId || req.body.requesterId;
  const conversation = await conversationService.deleteConversation(conversationId, solicitanteId);
  emitToUsers(conversation.participantes, 'conversation:deleted', {
    conversationId,
    deletedBy: solicitanteId,
  });
  return res.json({ data: conversation });
});

module.exports = {
  createConversation,
  listConversations,
  fetchConversationMessages,
  markConversationRead,
  removeConversation,
};
