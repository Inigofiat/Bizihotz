const createError = require('http-errors');
const asyncHandler = require('../utils/asyncHandler');
const {
  ensureSession,
  listSessions,
  getSessionOrFail,
  deleteSession,
  CHATBOT_TYPE,
  renameSession,
} = require('../services/sessionService');
const { listMessages, createChatbotMessage } = require('../services/messageService');
const { generateReply } = require('../services/aiService');

const createSession = asyncHandler(async (req, res) => {
  const usuarioId = req.body.usuarioId || req.body.userId;
  const titulo = (req.body.titulo || req.body.title || 'Sesion chatbot').toString().trim();
  if (!usuarioId) {
    throw createError(400, 'usuarioId es obligatorio');
  }
  const botId = `assistant-bot-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  const metadatos = {
    tipo: CHATBOT_TYPE,
    botId,
    titulo,
    participants: {
      [usuarioId]: usuarioId,
      [botId]: 'Asistente IA',
    },
  };
  const session = await ensureSession([usuarioId, botId], metadatos);
  if (titulo && (!session.titulo || session.titulo.startsWith('Sesion'))) {
    session.titulo = titulo;
    await session.save();
  }
  return res.status(201).json({ data: session.toPublicJSON() });
});

const listUserSessions = asyncHandler(async (req, res) => {
  const usuarioId = req.query.usuarioId || req.query.userId;
  const data = await listSessions(usuarioId);
  return res.json({ data });
});

const getSessionMessages = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { page, limit, order } = req.query;
  const result = await listMessages(sessionId, { page, limit, order });
  return res.json(result);
});

const postMessage = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const remitenteId = req.body.remitenteId || req.body.senderId;
  const contenido = req.body.contenido || req.body.content || '';
  const role = req.body.role || (req.body.esBot ? 'assistant' : 'user');
  if (!remitenteId) {
    throw createError(400, 'remitenteId es obligatorio');
  }
  const message = await createChatbotMessage({
    sesionId: sessionId,
    remitenteId,
    role,
    contenido,
    metadatos: {
      role,
      origen: 'chatbot',
    },
  });
  return res.status(201).json({ data: message });
});

const destroySession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const solicitanteId = req.body.solicitanteId || req.body.requesterId;
  const data = await deleteSession(sessionId, solicitanteId);
  return res.json({ data });
});

const updateSessionTitle = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const solicitanteId = req.body.solicitanteId || req.body.requesterId || req.body.usuarioId || req.body.userId;
  const titulo = req.body.titulo || req.body.title;
  const data = await renameSession(sessionId, solicitanteId, titulo);
  return res.json({ data });
});

const getSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await getSessionOrFail(sessionId);
  return res.json({ data: session.toPublicJSON() });
});

const aiReply = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const usuarioId = req.body.usuarioId || req.body.userId;
  const contenido = req.body.contenido || req.body.content || '';

  if (!usuarioId) {
    throw createError(400, 'usuarioId es obligatorio');
  }
  const session = await getSessionOrFail(sessionId);
  if (!session.participantes.includes(usuarioId)) {
    throw createError(403, 'El usuario no pertenece a la sesion');
  }

  const history = (await listMessages(sessionId, { limit: 40, order: 'asc' })).items.map((msg) => ({
    role: msg.role,
    text: msg.contenido,
  }));
  const replyText = await generateReply(contenido, history, session.toPublicJSON());
  const botId =
    session.metadatos?.botId ||
    session.participantes.find((p) => typeof p === 'string' && p.startsWith('assistant-bot')) ||
    'assistant-bot';

  const message = await createChatbotMessage({
    sesionId: sessionId,
    remitenteId: botId,
    role: 'assistant',
    contenido: replyText,
    metadatos: { role: 'assistant', origen: 'ai' },
  });

  return res.status(201).json({ data: message });
});

module.exports = {
  createSession,
  listUserSessions,
  getSessionMessages,
  postMessage,
  destroySession,
  getSession,
  aiReply,
  updateSessionTitle,
};
