const ScreenTime = require("../models/ScreenTime");
const User = require("../models/User");
const Alert = require("../models/Alert");
const FocusSession = require("../models/FocusSession");
const TrackingRule = require("../models/TrackingRule");
const { getIO } = require("../sockets");
const { emitAlert } = require("../utils/alertNotifier");

const formatThreshold = (value) => {
  const hours = Math.floor(value || 0);
  const minutes = Math.round(((value || 0) % 1) * 60);
  return `${hours}h ${minutes}m`;
};

const safeEmit = (room, event, payload) => {
  try {
    const io = getIO();
    if (io) io.to(room).emit(event, payload);
  } catch (error) {
    console.log("Socket emit skipped:", error.message);
  }
};

const defaultCategorize = (domain = "", title = "") => {
  const d = String(domain).toLowerCase();
  const t = String(title).toLowerCase();

  if (
    d.includes("youtube") ||
    d.includes("netflix") ||
    d.includes("spotify")
  ) {
    return "Entertainment";
  }

  if (
    d.includes("instagram") ||
    d.includes("facebook") ||
    d.includes("x.com") ||
    d.includes("reddit")
  ) {
    return "Social Media";
  }

  if (
    d.includes("leetcode") ||
    d.includes("geeksforgeeks") ||
    d.includes("coursera") ||
    d.includes("openai.com") ||
    t.includes("tutorial")
  ) {
    return "Study";
  }

  if (d.includes("steam") || d.includes("roblox")) {
    return "Gaming";
  }

  return "Other";
};

const applyCustomRule = async (userId, domain, title, url) => {
  const rules = await TrackingRule.find({
    user: userId,
    enabled: true,
  });

  const d = String(domain || "").toLowerCase();
  const t = String(title || "").toLowerCase();
  const u = String(url || "").toLowerCase();

  for (const rule of rules) {
    const pattern = String(rule.pattern || "").toLowerCase();

    if (rule.matchType === "domain" && d === pattern) return rule.category;
    if (rule.matchType === "url" && u === pattern) return rule.category;
    if (rule.matchType === "title" && t.includes(pattern)) return rule.category;

    if (
      rule.matchType === "contains" &&
      (d.includes(pattern) || u.includes(pattern) || t.includes(pattern))
    ) {
      return rule.category;
    }
  }

  return null;
};

const createThresholdAlerts = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    return {
      warningTriggered: false,
      dangerTriggered: false,
      todayTotal: 0,
    };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayEntries = await ScreenTime.find({
    user: userId,
    date: { $gte: startOfToday },
  });

  const todayTotal = todayEntries.reduce((sum, entry) => sum + entry.hours, 0);

  let warningTriggered = false;
  let dangerTriggered = false;

  if (todayTotal >= user.warningLimit && todayTotal < user.dangerLimit) {
    const message = `You reached your warning threshold of ${formatThreshold(
      user.warningLimit
    )}.`;

    const existingWarning = await Alert.findOne({
      user: userId,
      type: "warning",
      message,
      createdAt: { $gte: startOfToday },
    });

    if (!existingWarning) {
      const newAlert = await Alert.create({
        user: userId,
        message,
        type: "warning",
      });

      await emitAlert(userId, newAlert);

      warningTriggered = true;
    }
  }

  if (todayTotal >= user.dangerLimit) {
    const message = `You reached your danger threshold of ${formatThreshold(
      user.dangerLimit
    )}.`;

    const existingDanger = await Alert.findOne({
      user: userId,
      type: "danger",
      message,
      createdAt: { $gte: startOfToday },
    });

    if (!existingDanger) {
      const newAlert = await Alert.create({
        user: userId,
        message,
        type: "danger",
      });

      await emitAlert(userId, newAlert);

      dangerTriggered = true;
    }
  }

  return {
    warningTriggered,
    dangerTriggered,
    todayTotal,
  };
};

const getUserByToken = async (req) => {
  const token = req.headers["x-extension-token"];
  if (!token) return null;
  return User.findOne({ extensionToken: token });
};

const getExtensionBootstrap = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: "Login required",
      });
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const protocol = req.protocol;
    const host = req.get("host");

    return res.json({
      success: true,
      backendUrl: `${protocol}://${host}`,
      extensionToken: user.extensionToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("BOOTSTRAP ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to bootstrap extension",
    });
  }
};

const saveExtensionData = async (req, res) => {
  try {
    const user = await getUserByToken(req);
    const { minutes, domain, title, url } = req.body;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or missing extension token",
      });
    }

    const hours = Number(minutes) / 60;
    const cleanedDomain = String(domain || "").trim();
    const cleanedTitle = String(title || "").trim();
    const cleanedUrl = String(url || "").trim();

    const customCategory = await applyCustomRule(
      user._id,
      cleanedDomain,
      cleanedTitle,
      cleanedUrl
    );

    const category =
      customCategory || defaultCategorize(cleanedDomain, cleanedTitle);

    const entry = await ScreenTime.create({
      user: user._id,
      category,
      hours: Number(hours.toFixed(4)),
      notes: "Tracked by browser extension",
      domain: cleanedDomain,
      title: cleanedTitle,
      url: cleanedUrl,
      source: "extension",
    });

    const alertState = await createThresholdAlerts(user._id);

    safeEmit(`user_${user._id}`, "screenTimeUpdated", {
      userId: user._id,
      message: "Browser activity tracked",
      entry,
    });

    return res.status(201).json({
      success: true,
      message: "Extension data saved successfully",
      entry,
      alert: {
        warningTriggered: alertState.warningTriggered,
        dangerTriggered: alertState.dangerTriggered,
        todayTotal: Number((alertState.todayTotal || 0).toFixed(4)),
        todayTotalFormatted: formatThreshold(alertState.todayTotal || 0),
      },
    });
  } catch (error) {
    console.error("EXTENSION TRACK ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save extension tracking data",
    });
  }
};

const getExtensionTodaySummary = async (req, res) => {
  try {
    const user = await getUserByToken(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or missing extension token",
      });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayEntries = await ScreenTime.find({
      user: user._id,
      date: { $gte: startOfToday },
    }).sort({ createdAt: -1 });

    const todayTotal = todayEntries.reduce((sum, entry) => sum + entry.hours, 0);

    const categoryTotals = {
      "Social Media": 0,
      Entertainment: 0,
      Study: 0,
      Gaming: 0,
      Other: 0,
    };

    todayEntries.forEach((entry) => {
      if (categoryTotals[entry.category] !== undefined) {
        categoryTotals[entry.category] += entry.hours;
      } else {
        categoryTotals.Other += entry.hours;
      }
    });

    let topCategory = "No data";
    let maxHours = 0;

    Object.entries(categoryTotals).forEach(([category, hours]) => {
      if (hours > maxHours) {
        maxHours = hours;
        topCategory = category;
      }
    });

    let usageStatus = "Healthy";

    if (todayTotal >= user.warningLimit && todayTotal < user.dangerLimit) {
      usageStatus = "Approaching Limit";
    } else if (todayTotal >= user.dangerLimit) {
      usageStatus = "Limit Reached";
    }

    const activeFocusSession = await FocusSession.findOne({
      user: user._id,
      status: "active",
      endTime: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      summary: {
        todayTotal: Number(todayTotal.toFixed(4)),
        todayTotalFormatted: formatThreshold(todayTotal),
        sessionCount: todayEntries.length,
        topCategory,
        usageStatus,
        dailyLimit: user.dailyLimit,
        warningLimit: user.warningLimit,
        dangerLimit: user.dangerLimit,
      },
      focusMode: activeFocusSession
        ? {
            active: true,
            endTime: activeFocusSession.endTime,
            blockedSites: activeFocusSession.blockedSites || [],
            remainingMs: Math.max(
              new Date(activeFocusSession.endTime).getTime() - Date.now(),
              0
            ),
          }
        : {
            active: false,
            endTime: null,
            blockedSites: [],
            remainingMs: 0,
          },
    });
  } catch (error) {
    console.error("EXTENSION SUMMARY ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch extension summary",
    });
  }
};

module.exports = {
  getExtensionBootstrap,
  saveExtensionData,
  getExtensionTodaySummary,
};
