const LiveSession = require("../models/LiveSession");
const User = require("../models/User");
const { createUniqueAlert } = require("../utils/alertNotifier");

function getUserIdFromRequest(req) {
  return req.session?.userId || null;
}

function calculateElapsedMinutes(startedAt) {
  if (!startedAt) return 0;
  return (Date.now() - new Date(startedAt).getTime()) / 1000 / 60;
}

function calculateElapsedSeconds(startedAt) {
  if (!startedAt) return 0;
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
}

function limitHoursToSeconds(hours) {
  return Math.round(Number(hours || 0) * 60 * 60);
}

function formatElapsedClock(totalSeconds) {
  const seconds = Math.max(Number(totalSeconds) || 0, 0);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

async function createLiveSessionThresholdAlerts(user, session, elapsedSeconds) {
  const warningLimitSeconds = limitHoursToSeconds(user.warningLimit);
  const dangerLimitSeconds = limitHoursToSeconds(user.dangerLimit);
  const warningLimitFormatted = formatElapsedClock(warningLimitSeconds);
  const dangerLimitFormatted = formatElapsedClock(dangerLimitSeconds);
  const dedupeSince = session.startedAt || new Date(Date.now() - 60 * 1000);

  if (dangerLimitSeconds > 0 && elapsedSeconds >= dangerLimitSeconds) {
    await createUniqueAlert({
      userId: user._id,
      type: "danger",
      message: `Danger: Live session crossed ${dangerLimitFormatted}`,
      dedupeSince,
    });
    return;
  }

  if (warningLimitSeconds > 0 && elapsedSeconds >= warningLimitSeconds) {
    await createUniqueAlert({
      userId: user._id,
      type: "warning",
      message: `Warning: Live session crossed ${warningLimitFormatted}`,
      dedupeSince,
    });
  }
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
      const warningLimitSeconds = limitHoursToSeconds(user.warningLimit);
      const dangerLimitSeconds = limitHoursToSeconds(user.dangerLimit);

      return res.json({
        success: true,
        active: false,
        elapsedSeconds: 0,
        elapsedFormatted: "0:00",
        startedAt: null,
        warningLimitMinutes: warningLimitSeconds / 60,
        dangerLimitMinutes: dangerLimitSeconds / 60,
        warningLimitSeconds,
        dangerLimitSeconds,
        warningTriggered: false,
        dangerTriggered: false,
      });
    }

    const elapsedSeconds = calculateElapsedSeconds(session.startedAt);
    const warningLimitSeconds = limitHoursToSeconds(user.warningLimit);
    const dangerLimitSeconds = limitHoursToSeconds(user.dangerLimit);
    const warningLimitMinutes = warningLimitSeconds / 60;
    const dangerLimitMinutes = dangerLimitSeconds / 60;
    const warningTriggered = elapsedSeconds >= warningLimitSeconds;
    const dangerTriggered = elapsedSeconds >= dangerLimitSeconds;

    if (warningTriggered || dangerTriggered) {
      await createLiveSessionThresholdAlerts(user, session, elapsedSeconds);
    }

    return res.json({
      success: true,
      active: true,
      startedAt: session.startedAt,
      elapsedSeconds,
      elapsedFormatted: formatElapsedClock(elapsedSeconds),
      warningLimitMinutes,
      dangerLimitMinutes,
      warningLimitSeconds,
      dangerLimitSeconds,
      warningTriggered,
      dangerTriggered,
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
