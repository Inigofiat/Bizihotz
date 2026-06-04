const createError = require('http-errors');
const Session = require('../models/Session');
const Message = require('../models/Message');

const CHATBOT_TYPE = 'chatbot';

const buildKey = (participants) =>
  participants
    .map((p) => String(p).trim())
    .filter(Boolean)
    .sort()
    .join('#');

const ensureSession = async (participants, metadata = {}) => {
  if (!Array.isArray(participants) || participants.length < 2) {
    throw createError(400, 'Se requieren al menos dos participantes');
  }
  const claveParticipantes = buildKey(participants);
  let session = await Session.findOne({ claveParticipantes });
  if (!session) {
    session = await Session.create({
      participantes: participants,
      claveParticipantes,
      tipo: metadata.tipo || CHATBOT_TYPE,
      titulo: metadata.titulo,
      metadatos: metadata,
      noLeidos: participants.reduce((acc, p) => {
        acc.set(String(p), 0);
        return acc;
      }, new Map()),
    });
  } else if (metadata && metadata.tipo === CHATBOT_TYPE) {
    session.metadatos = { ...(session.metadatos || {}), ...metadata };
    if (metadata.titulo) {
      session.titulo = metadata.titulo;
    }
    await session.save();
  }
  return session;
};

const getSessionOrFail = async (sessionId) => {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw createError(404, 'Sesion no encontrada');
  }
  return session;
};

const listSessions = async (usuarioId) => {
  if (!usuarioId) {
    throw createError(400, 'usuarioId es obligatorio');
  }
  const sessions = await Session.find({ participantes: usuarioId, tipo: CHATBOT_TYPE })
    .sort({ actualizadoEn: -1 })
    .lean();
  return sessions.map((session) => ({
    id: session._id.toString(),
    tipo: session.tipo,
    participantes: session.participantes,
    titulo: session.titulo,
    metadatos: session.metadatos,
    noLeidos: Session.toPlainUnread(session.noLeidos),
    ultimoMensaje: session.ultimoMensaje,
    actualizadoEn: session.actualizadoEn,
    creadoEn: session.creadoEn,
  }));
};

const deleteSession = async (sessionId, requesterId) => {
  if (!requesterId) {
    throw createError(400, 'solicitanteId es obligatorio');
  }
  const session = await getSessionOrFail(sessionId);
  if (!session.participantes.includes(requesterId)) {
    throw createError(403, 'No perteneces a esta sesion');
  }
  await Message.deleteMany({ sesionId: session._id });
  await session.deleteOne();
  return session.toPublicJSON();
};

const updateUnreadForMessage = async (session, message) => {
  session.ultimoMensaje = {
    idMensaje: message._id.toString(),
    contenido: message.contenido,
    enviadoEn: message.enviadoEn,
    remitenteId: message.remitenteId,
    role: message.rol || message.role,
  };
  session.noLeidos ??= new Map();
  session.participantes.forEach((p) => {
    if (p === message.remitenteId) {
      session.noLeidos.set(p, 0);
    } else {
      const current = session.noLeidos.get(p) || 0;
      session.noLeidos.set(p, current + 1);
    }
  });
  await session.save();
  return session;
};

const renameSession = async (sessionId, requesterId, titulo) => {
  if (!requesterId) {
    throw createError(400, 'solicitanteId es obligatorio');
  }
  const cleanTitle = (titulo || '').toString().trim();
  if (!cleanTitle) {
    throw createError(400, 'titulo no puede estar vacio');
  }
  const session = await getSessionOrFail(sessionId);
  if (!session.participantes.includes(requesterId)) {
    throw createError(403, 'No perteneces a esta sesion');
  }
  session.titulo = cleanTitle;
  await session.save();
  return session.toPublicJSON();
};

module.exports = {
  ensureSession,
  getSessionOrFail,
  listSessions,
  deleteSession,
  updateUnreadForMessage,
  CHATBOT_TYPE,
  renameSession,
};
