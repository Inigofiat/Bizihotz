const { Server } = require('socket.io');
const config = require('../config/env');
const {
  createMessage,
  markMessageAsRead,
  markConversationAsRead,
} = require('../services/messageService');

const resolveCorsConfig = () => {
  const allowAll = config.socketAllowedOrigins.includes('*');
  return {
    origin: allowAll ? '*' : config.socketAllowedOrigins,
    methods: ['GET', 'POST', 'PATCH'],
    credentials: !allowAll,
  };
};

const safeAck = (ack, error, data) => {
  if (typeof ack === 'function') {
    ack(error, data);
  }
};

const registerChatGateway = (server) => {
  const io = new Server(server, {
    cors: resolveCorsConfig(),
  });

  io.use((socket, next) => {
    const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
    if (!userId) {
      return next(new Error('userId es obligatorio para conectar con Socket.IO'));
    }

    socket.data.userId = String(userId);
    return next();
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.join(`user:${userId}`);
    socket.emit('connection:ready', {
      userId,
      connectedAt: new Date().toISOString(),
    });

    socket.on('message:send', async (payload = {}, ack) => {
      try {
        const remitenteId = payload.remitenteId || payload.senderId || userId;
        const message = await createMessage({
          ...payload,
          remitenteId,
          destinatarioId: payload.destinatarioId || payload.recipientId,
          contenido: payload.contenido ?? payload.content,
          adjuntos: payload.adjuntos ?? payload.attachments,
          conversacionId: payload.conversacionId || payload.conversationId,
        });

        io.to(`user:${message.remitenteId}`).emit('message:new', message);
        io.to(`user:${message.destinatarioId}`).emit('message:new', message);
        safeAck(ack, null, message);
      } catch (error) {
        const message = error.message || 'No se pudo enviar el mensaje';
        socket.emit('message:error', { message });
        safeAck(ack, { message });
      }
    });

    socket.on('message:read', async ({ messageId }, ack) => {
      try {
        const updated = await markMessageAsRead(messageId, userId);
        io.to(`user:${updated.remitenteId}`).emit('message:read', updated);
        io.to(`user:${updated.destinatarioId}`).emit('message:read', updated);
        safeAck(ack, null, updated);
      } catch (error) {
        const message = error.message || 'No se pudo actualizar el mensaje';
        safeAck(ack, { message });
      }
    });

    socket.on('conversation:read', async ({ conversationId }, ack) => {
      try {
        const conversation = await markConversationAsRead(conversationId, userId);
        conversation.participantes.forEach((participant) => {
          io.to(`user:${participant}`).emit('conversation:read', {
            conversationId: conversation.id,
            readerId: userId,
            unreadCounts: conversation.noLeidos,
          });
        });
        safeAck(ack, null, conversation);
      } catch (error) {
        const message = error.message || 'No se pudo actualizar la conversacion';
        safeAck(ack, { message });
      }
    });

    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`);
    });
  });

  return io;
};

module.exports = registerChatGateway;
