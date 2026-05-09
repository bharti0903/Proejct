const Alert = require("../models/Alert");
const { getIO } = require("../sockets");

const emitAlert = async (userId, alert) => {
  const unreadCount = await Alert.countDocuments({
    user: userId,
    isRead: false,
  });

  try {
    const io = getIO();
    if (io) {
      io.to(`user_${userId}`).emit("newAlert", {
        id: alert._id.toString(),
        type: alert.type,
        message: alert.message,
        createdAt: alert.createdAt,
        unreadCount,
      });
    }
  } catch (error) {
    console.log("Alert socket emit skipped:", error.message);
  }

  return unreadCount;
};

const createUniqueAlert = async ({ userId, type, message, dedupeSince }) => {
  const existingAlert = await Alert.findOne({
    user: userId,
    type,
    message,
    createdAt: { $gte: dedupeSince || new Date(Date.now() - 60 * 1000) },
  });

  if (existingAlert) {
    return { alert: existingAlert, created: false };
  }

  const alert = await Alert.create({
    user: userId,
    type,
    message,
  });

  await emitAlert(userId, alert);
  return { alert, created: true };
};

module.exports = {
  createUniqueAlert,
  emitAlert,
};
