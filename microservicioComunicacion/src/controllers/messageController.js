const asyncHandler = require('../utils/asyncHandler');
const {
  createMessage,
  markMessageAsRead,
  editMessageContent,
  deleteMessage,
} = require('../services/messageService');
const { emitToUsers } = require('../utils/socketEmitter');

const sendMessage = asyncHandler(async (req, res) => {
  const remitenteId = req.body.remitenteId || req.body.senderId;
  const destinatarioId = req.body.destinatarioId || req.body.recipientId;
  const contenido = req.body.contenido ?? req.body.content;
  const adjuntos = req.body.adjuntos ?? req.body.attachments;
  const conversacionId = req.body.conversacionId || req.body.conversationId;
  const metadatos = req.body.metadatos || req.body.metadata;
  const message = await createMessage({
    remitenteId,
    destinatarioId,
    contenido,
    adjuntos,
    conversacionId,
    metadatos,
  });
  emitToUsers([message.remitenteId, message.destinatarioId], 'message:new', message);
  return res.status(201).json({ data: message });
});

const markMessageRead = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const lectorId = req.body.lectorId || req.body.readerId;
  const message = await markMessageAsRead(messageId, lectorId);
  return res.json({ data: message });
});

const updateMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { editorId, contenido } = req.body;
  const message = await editMessageContent(messageId, editorId, contenido);
  emitToUsers([message.remitenteId, message.destinatarioId], 'message:updated', message);
  return res.json({ data: message });
});

const destroyMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const solicitanteId = req.body.solicitanteId || req.body.requesterId;
  const result = await deleteMessage(messageId, solicitanteId);
  emitToUsers([result.remitenteId, result.destinatarioId], 'message:deleted', result);
  return res.json({ data: result });
});

module.exports = {
  sendMessage,
  markMessageRead,
  updateMessage,
  destroyMessage,
};
