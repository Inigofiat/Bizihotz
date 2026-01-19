const createError = require('http-errors');
const Message = require('../models/Message');
const Session = require('../models/Session');
const {
  getSessionOrFail,
  updateUnreadForMessage,
} = require('./sessionService');

const sanitizeRole = (role) => (role === 'assistant' ? 'assistant' : 'user');

const createChatbotMessage = async ({ sesionId, remitenteId, contenido, role = 'user', metadatos }) => {
  if (!sesionId || !remitenteId) {
    throw createError(400, 'sesionId y remitenteId son obligatorios');
  }
  const trimmed = (contenido || '').trim();
  if (!trimmed) {
    throw createError(400, 'contenido no puede estar vacio');
  }

  const session = await getSessionOrFail(sesionId);
  if (!session.participantes.includes(remitenteId)) {
    throw createError(403, 'El remitente no pertenece a la sesion');
  }

  const message = await Message.create({
    sesionId: session._id,
    remitenteId,
    role: sanitizeRole(role),
    contenido: trimmed,
    metadatos,
  });

  await updateUnreadForMessage(session, message);

  return message.toPublicJSON();
};

const listMessages = async (sesionId, { page = 1, limit = 50, order = 'asc' } = {}) => {
  const session = await getSessionOrFail(sesionId);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;
  const safeOrder = order === 'desc' ? -1 : 1;

  const [items, total] = await Promise.all([
    Message.find({ sesionId: session._id })
      .sort({ enviadoEn: safeOrder })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Message.countDocuments({ sesionId: session._id }),
  ]);

  return {
    session: session.toPublicJSON(),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: safePage * safeLimit < total,
    },
    items: items.map((msg) => ({
      id: msg._id.toString(),
      sesionId: msg.sesionId.toString(),
      remitenteId: msg.remitenteId,
      role: msg.role,
      contenido: msg.contenido,
      metadatos: msg.metadatos,
      enviadoEn: msg.enviadoEn,
      creadoEn: msg.creadoEn,
      actualizadoEn: msg.actualizadoEn,
    })),
  };
};

const deleteMessagesBySession = async (sesionId) => {
  if (!sesionId) return;
  await Message.deleteMany({ sesionId });
};

module.exports = {
  createChatbotMessage,
  listMessages,
  deleteMessagesBySession,
};
