let ioInstance = null;

const setSocketServer = (io) => {
  ioInstance = io;
};

const getSocketServer = () => ioInstance;

const emitToUser = (userId, event, payload) => {
  if (!ioInstance || !userId || !event) {
    return;
  }
  ioInstance.to(`user:${userId}`).emit(event, payload);
};

const emitToUsers = (userIds = [], event, payload) => {
  if (!ioInstance || !Array.isArray(userIds)) {
    return;
  }

  const unique = [...new Set(userIds.filter(Boolean))];
  unique.forEach((userId) => emitToUser(userId, event, payload));
};

module.exports = {
  setSocketServer,
  getSocketServer,
  emitToUser,
  emitToUsers,
};
