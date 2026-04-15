let ioInstance = null;

export function setIo(io) {
  ioInstance = io;
}

export function emitToUser(userId, eventName, payload) {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit(eventName, payload);
}
