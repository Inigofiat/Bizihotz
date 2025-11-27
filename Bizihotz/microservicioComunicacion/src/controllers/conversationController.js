const asyncHandler = require('../utils/asyncHandler');
const conversationService = require('../services/conversationService');
const {
  getMessagesByConversation,
  markConversationAsRead,
} = require('../services/messageService');
const { emitToUsers } = require('../utils/socketEmitter');

const createConversation = asyncHandler(async (req, res) => {
  const { requesterId, participantId, metadata } = req.body;
  const conversation = await conversationService.ensureConversation(
    [requesterId, participantId],
    metadata
  );
  return res.status(201).json({ data: conversation.toPublicJSON() });
});

const listConversations = asyncHandler(async (req, res) => {
  const { userId } = req.query;
  const conversations = await conversationService.listUserConversations(userId);
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
  const { readerId } = req.body;
  const conversation = await markConversationAsRead(conversationId, readerId);
  return res.json({ data: conversation });
});

const removeConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { requesterId } = req.body;
  const conversation = await conversationService.deleteConversation(conversationId, requesterId);
  emitToUsers(conversation.participants, 'conversation:deleted', {
    conversationId,
    deletedBy: requesterId,
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
