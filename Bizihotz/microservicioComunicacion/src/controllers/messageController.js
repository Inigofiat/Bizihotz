const asyncHandler = require('../utils/asyncHandler');
const {
  createMessage,
  markMessageAsRead,
  editMessageContent,
  deleteMessage,
} = require('../services/messageService');
const { emitToUsers } = require('../utils/socketEmitter');

const sendMessage = asyncHandler(async (req, res) => {
  const { senderId, recipientId, content, attachments, conversationId, metadata } = req.body;
  const message = await createMessage({
    senderId,
    recipientId,
    content,
    attachments,
    conversationId,
    metadata,
  });
  emitToUsers([message.senderId, message.recipientId], 'message:new', message);
  return res.status(201).json({ data: message });
});

const markMessageRead = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { readerId } = req.body;
  const message = await markMessageAsRead(messageId, readerId);
  return res.json({ data: message });
});

const updateMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { editorId, content } = req.body;
  const message = await editMessageContent(messageId, editorId, content);
  emitToUsers([message.senderId, message.recipientId], 'message:updated', message);
  return res.json({ data: message });
});

const destroyMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { requesterId } = req.body;
  const result = await deleteMessage(messageId, requesterId);
  emitToUsers([result.senderId, result.recipientId], 'message:deleted', result);
  return res.json({ data: result });
});

module.exports = {
  sendMessage,
  markMessageRead,
  updateMessage,
  destroyMessage,
};
