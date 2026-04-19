const LiveSession = require("../models/LiveSession");
const User = require("../models/User");

function getUserIdFromRequest(req) {
  return req.session?.userId || null;
}

function calculateElapsedMinutes(startedAt) {
  if (!startedAt) return 0;
  return (Date.now() - new Date(startedAt).getTime()) / 1000 / 60;
}

const startLiveSession = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Login required",
      });
    }

    // Stop previous active session
    await LiveSession.updateMany(
      { user: userId, active: true },
      {
        $set: {
          active: false,
          stoppedAt: new Date(),
        },
      }
    );

    // Start new session
    const session = await LiveSession.create({
      user: userId,
      active: true,
      startedAt: new Date(),
      stoppedAt: null,
      source: "track-screen-time",
    });

    return res.json({
      success: true,
      message: "New live session started",
      session: {
        id: session._id,
        active: session.active,
        startedAt: session.startedAt,
      },
    });
  } catch (error) {
    console.error("START LIVE SESSION ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start live session",
    });
  }
};

const stopLiveSession = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Login required",
      });
    }

    const session = await LiveSession.findOneAndUpdate(
      { user: userId, active: true },
      {
        $set: {
          active: false,
          stoppedAt: new Date(),
        },
      },
      { new: true, sort: { createdAt: -1 } }
    );

    return res.json({
      success: true,
      message: session ? "Live session stopped" : "No active live session found",
    });
  } catch (error) {
    console.error("STOP LIVE SESSION ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to stop live session",
    });
  }
};

const getLiveSessionStatus = async (req, res) => {
  try {
    const token = req.headers["x-extension-token"];
    let user = null;

    if (token) {
      user = await User.findOne({ extensionToken: token });
    } else if (req.session?.userId) {
      user = await User.findById(req.session.userId);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const session = await LiveSession.findOne({
      user: user._id,
      active: true,
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.json({
        success: true,
        active: false,
        elapsedMinutes: 0,
        startedAt: null,
        warningLimitMinutes: Number(user.warningLimit || 0) * 60,
        dangerLimitMinutes: Number(user.dangerLimit || 0) * 60,
        warningTriggered: false,
        dangerTriggered: false,
      });
    }

    const elapsedMinutes = calculateElapsedMinutes(session.startedAt);
    const warningLimitMinutes = Number(user.warningLimit || 0) * 60;
    const dangerLimitMinutes = Number(user.dangerLimit || 0) * 60;

    return res.json({
      success: true,
      active: true,
      startedAt: session.startedAt,
      elapsedMinutes: Number(elapsedMinutes.toFixed(2)),
      warningLimitMinutes,
      dangerLimitMinutes,
      warningTriggered: elapsedMinutes >= warningLimitMinutes,
      dangerTriggered: elapsedMinutes >= dangerLimitMinutes,
    });
  } catch (error) {
    console.error("LIVE SESSION STATUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch live session status",
    });
  }
};

module.exports = {
  startLiveSession,
  stopLiveSession,
  getLiveSessionStatus,
};