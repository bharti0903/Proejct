const FocusSession = require("../models/FocusSession");

const DISTRACTING_SITES = [
  "youtube.com",
  "www.youtube.com",
  "instagram.com",
  "www.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "x.com",
  "twitter.com",
  "www.twitter.com",
  "reddit.com",
  "www.reddit.com",
  "netflix.com",
  "www.netflix.com",
  "hotstar.com",
  "www.hotstar.com",
];

const normalizeSites = (sites) => {
  if (!Array.isArray(sites)) return [];
  return sites
    .map((site) => String(site || "").trim().toLowerCase())
    .filter(Boolean);
};

const expireOldSessions = async (userId) => {
  await FocusSession.updateMany(
    {
      user: userId,
      status: "active",
      endTime: { $lte: new Date() },
    },
    {
      $set: { status: "expired" },
    }
  );
};

const getFocusModePage = async (req, res) => {
  try {
    await expireOldSessions(req.session.userId);

    const activeSession = await FocusSession.findOne({
      user: req.session.userId,
      status: "active",
      endTime: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    const recentSessions = await FocusSession.find({
      user: req.session.userId,
    })
      .sort({ createdAt: -1 })
      .limit(10);

    res.render("store/focusMode", {
      userName: req.session.userName || null,
      activeSession,
      recentSessions,
      defaultSites: DISTRACTING_SITES,
      error: null,
      success: null,
    });
  } catch (error) {
    console.error("FOCUS PAGE ERROR:", error);
    res.render("store/focusMode", {
      userName: req.session.userName || null,
      activeSession: null,
      recentSessions: [],
      defaultSites: DISTRACTING_SITES,
      error: "Could not load focus mode page",
      success: null,
    });
  }
};

const startFocusSession = async (req, res) => {
  try {
    await expireOldSessions(req.session.userId);

    const existing = await FocusSession.findOne({
      user: req.session.userId,
      status: "active",
      endTime: { $gt: new Date() },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A focus session is already active",
      });
    }

    const durationMinutes = Number(req.body.durationMinutes);
    const blockDistractingSites = req.body.blockDistractingSites === true;
    const customSites = normalizeSites(req.body.customSites);

    if (!durationMinutes || durationMinutes < 1 || durationMinutes > 720) {
      return res.status(400).json({
        success: false,
        message: "Duration must be between 1 and 720 minutes",
      });
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    const blockedSites = blockDistractingSites
      ? Array.from(new Set([...DISTRACTING_SITES, ...customSites]))
      : normalizeSites(customSites);

    const session = await FocusSession.create({
      user: req.session.userId,
      durationMinutes,
      startTime,
      endTime,
      blockedSites,
      status: "active",
    });

    return res.status(201).json({
      success: true,
      message: "Focus session started",
      session,
    });
  } catch (error) {
    console.error("START FOCUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start focus session",
    });
  }
};

const getActiveFocusSession = async (req, res) => {
  try {
    await expireOldSessions(req.session.userId);

    const session = await FocusSession.findOne({
      user: req.session.userId,
      status: "active",
      endTime: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.json({
        success: true,
        active: false,
        session: null,
      });
    }

    const remainingMs = Math.max(
      new Date(session.endTime).getTime() - Date.now(),
      0
    );

    return res.json({
      success: true,
      active: true,
      session: {
        _id: session._id,
        durationMinutes: session.durationMinutes,
        startTime: session.startTime,
        endTime: session.endTime,
        blockedSites: session.blockedSites,
        status: session.status,
        remainingMs,
      },
    });
  } catch (error) {
    console.error("GET ACTIVE FOCUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active focus session",
    });
  }
};

const stopFocusSession = async (req, res) => {
  try {
    await expireOldSessions(req.session.userId);

    const session = await FocusSession.findOne({
      user: req.session.userId,
      status: "active",
      endTime: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "No active focus session found",
      });
    }

    session.status = "stopped";
    await session.save();

    return res.json({
      success: true,
      message: "Focus session stopped",
    });
  } catch (error) {
    console.error("STOP FOCUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to stop focus session",
    });
  }
};

module.exports = {
  getFocusModePage,
  startFocusSession,
  getActiveFocusSession,
  stopFocusSession,
};