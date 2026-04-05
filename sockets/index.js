let ioInstance = null;

const initSocket = (io) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    socket.on("joinUserRoom", (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
      }
    });

    socket.on("disconnect", () => {
      // no-op
    });
  });
};

const getIO = () => {
  return ioInstance;
};

module.exports = {
  initSocket,
  getIO
};