const ScreenTime = require("../models/ScreenTime");
const User = require("../models/User");
const Alert = require("../models/Alert");
const { getIO } = require("../sockets");

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

const getTodayStats = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const todayEntries = await ScreenTime.find({
    user: userId,
    date: { $gte: startOfToday, $lt: endOfToday },
  }).sort({ createdAt: -1 });

  const todayTotal = todayEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const sessionCount = todayEntries.length;
  const timeLeft = Math.max(user.dailyLimit - todayTotal, 0);

  let usageStatus = "Healthy";
  if (todayTotal >= user.warningLimit && todayTotal < user.dangerLimit) {
    usageStatus = "Approaching Limit";
  } else if (todayTotal >= user.dangerLimit) {
    usageStatus = "Limit Reached";
  }

  return {
    user,
    todayEntries,
    todayTotal,
    sessionCount,
    timeLeft,
    usageStatus,
  };
};

const getTrackPage = async (req, res) => {
  try {
    const stats = await getTodayStats(req.session.userId);
    if (!stats) {
      return res.redirect("/login");
    }

    const entries = await ScreenTime.find({ user: req.session.userId }).sort({
      createdAt: -1,
    });

    const todayCategoryTotals = {
      "Social Media": 0,
      Entertainment: 0,
      Study: 0,
      Gaming: 0,
      Other: 0,
    };

    stats.todayEntries.forEach((entry) => {
      if (todayCategoryTotals[entry.category] !== undefined) {
        todayCategoryTotals[entry.category] += entry.hours;
      }
    });

    let mostUsedCategory = "No data";
    let maxHours = 0;

    Object.entries(todayCategoryTotals).forEach(([category, hours]) => {
      if (hours > maxHours) {
        maxHours = hours;
        mostUsedCategory = category;
      }
    });

    const progressPercent =
      stats.user.dailyLimit > 0
        ? Math.min((stats.todayTotal / stats.user.dailyLimit) * 100, 100)
        : 0;

    res.render("store/trackScreenTime", {
      entries,
      todayEntries: stats.todayEntries,
      editEntry: null,
      error: null,
      success: null,
      userName: req.session.userName || null,
      userId: req.session.userId,
      todayTotal: Number(stats.todayTotal.toFixed(4)),
      sessionCount: stats.sessionCount,
      timeLeft: Number(stats.timeLeft.toFixed(4)),
      mostUsedCategory,
      usageStatus: stats.usageStatus,
      progressPercent: Number(progressPercent.toFixed(1)),
      warningLimit: stats.user.warningLimit,
      dangerLimit: stats.user.dangerLimit,
      dailyLimit: stats.user.dailyLimit,
    });
  } catch (error) {
    console.error(error);
    res.render("store/trackScreenTime", {
      entries: [],
      todayEntries: [],
      editEntry: null,
      error: "Could not load activity records",
      success: null,
      userName: req.session.userName || null,
      userId: req.session.userId,
      todayTotal: 0,
      sessionCount: 0,
      timeLeft: 0,
      mostUsedCategory: "No data",
      usageStatus: "Healthy",
      progressPercent: 0,
      warningLimit: 0,
      dangerLimit: 0,
      dailyLimit: 0,
    });
  }
};

const handleDailyLimitAlert = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    return {
      warningTriggered: false,
      dangerTriggered: false,
      todayTotal: 0,
      sessionCount: 0,
      timeLeft: 0,
      usageStatus: "Healthy",
    };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const todayEntries = await ScreenTime.find({
    user: userId,
    date: { $gte: startOfToday, $lt: endOfToday },
  });

  const todayTotal = todayEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const sessionCount = todayEntries.length;
  const timeLeft = Math.max(user.dailyLimit - todayTotal, 0);

  let usageStatus = "Healthy";
  if (todayTotal >= user.warningLimit && todayTotal < user.dangerLimit) {
    usageStatus = "Approaching Limit";
  } else if (todayTotal >= user.dangerLimit) {
    usageStatus = "Limit Reached";
  }

  let warningTriggered = false;
  let dangerTriggered = false;

  if (todayTotal >= user.warningLimit && todayTotal < user.dangerLimit) {
    const message = `You reached your warning threshold of ${formatThreshold(
      user.warningLimit
    )}.`;

    const existingWarning = await Alert.findOne({
      user: userId,
      message,
      type: "warning",
      createdAt: { $gte: startOfToday },
    });

    if (!existingWarning) {
      const newAlert = await Alert.create({
        user: userId,
        message,
        type: "warning",
      });

      safeEmit(`user_${userId}`, "newAlert", {
        id: newAlert._id,
        type: newAlert.type,
        message: newAlert.message,
      });

      warningTriggered = true;
    }
  }

  if (todayTotal >= user.dangerLimit) {
    const message = `You reached your danger threshold of ${formatThreshold(
      user.dangerLimit
    )}.`;

    const existingDanger = await Alert.findOne({
      user: userId,
      message,
      type: "danger",
      createdAt: { $gte: startOfToday },
    });

    if (!existingDanger) {
      const newAlert = await Alert.create({
        user: userId,
        message,
        type: "danger",
      });

      safeEmit(`user_${userId}`, "newAlert", {
        id: newAlert._id,
        type: newAlert.type,
        message: newAlert.message,
      });

      dangerTriggered = true;
    }
  }

  return {
    warningTriggered,
    dangerTriggered,
    todayTotal,
    sessionCount,
    timeLeft,
    usageStatus,
  };
};

const addScreenTime = async (req, res) => {
  try {
    const { category, hours, notes } = req.body;

    if (!category || !hours || Number(hours) < 0 || Number(hours) > 24) {
      return res.redirect("/track-screen-time");
    }

    await ScreenTime.create({
      user: req.session.userId,
      category,
      hours: Number(Number(hours).toFixed(4)),
      notes: notes ? notes.trim() : "",
      source: "manual",
    });

    await handleDailyLimitAlert(req.session.userId);

    safeEmit(`user_${req.session.userId}`, "screenTimeUpdated", {
      userId: req.session.userId,
      message: "Screen time updated",
    });

    res.redirect("/track-screen-time");
  } catch (error) {
    console.error(error);
    res.redirect("/track-screen-time");
  }
};

const saveTrackedSession = async (req, res) => {
  try {
    const { category, minutes, notes } = req.body;

    if (!category || minutes === undefined || Number(minutes) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid tracking session data",
      });
    }

    const hours = Number(minutes) / 60;

    const entry = await ScreenTime.create({
      user: req.session.userId,
      category,
      hours: Number(hours.toFixed(4)),
      notes: notes ? notes.trim() : "Live tracked session",
      source: "live-session",
    });

    const alertState = await handleDailyLimitAlert(req.session.userId);

    safeEmit(`user_${req.session.userId}`, "screenTimeUpdated", {
      userId: req.session.userId,
      message: "Screen time updated",
      entry,
    });

    return res.status(201).json({
      success: true,
      message: "Session saved successfully",
      entry,
      alert: {
        warningTriggered: alertState.warningTriggered,
        dangerTriggered: alertState.dangerTriggered,
        todayTotal: Number(alertState.todayTotal.toFixed(4)),
        sessionCount: alertState.sessionCount,
        timeLeft: Number(alertState.timeLeft.toFixed(4)),
        usageStatus: alertState.usageStatus,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to save tracked session",
    });
  }
};

const getEditScreenTimePage = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const entries = await ScreenTime.find({ user: req.session.userId }).sort({
      createdAt: -1,
    });

    const editEntry = await ScreenTime.findOne({
      _id: req.params.id,
      user: req.session.userId,
    });

    if (!editEntry) {
      return res.redirect("/track-screen-time");
    }

    const stats = await getTodayStats(req.session.userId);

    const progressPercent =
      user.dailyLimit > 0
        ? Math.min((stats.todayTotal / user.dailyLimit) * 100, 100)
        : 0;

    res.render("store/trackScreenTime", {
      entries,
      todayEntries: stats.todayEntries,
      editEntry,
      error: null,
      success: null,
      userName: req.session.userName || null,
      userId: req.session.userId,
      todayTotal: Number(stats.todayTotal.toFixed(4)),
      sessionCount: stats.sessionCount,
      timeLeft: Number(stats.timeLeft.toFixed(4)),
      mostUsedCategory: "No data",
      usageStatus: stats.usageStatus,
      progressPercent: Number(progressPercent.toFixed(1)),
      warningLimit: user.warningLimit,
      dangerLimit: user.dangerLimit,
      dailyLimit: user.dailyLimit,
    });
  } catch (error) {
    console.error(error);
    res.redirect("/track-screen-time");
  }
};

const updateScreenTime = async (req, res) => {
  try {
    const { category, hours, notes } = req.body;

    await ScreenTime.findOneAndUpdate(
      { _id: req.params.id, user: req.session.userId },
      {
        category,
        hours: Number(Number(hours).toFixed(4)),
        notes: notes ? notes.trim() : "",
      }
    );

    res.redirect("/track-screen-time");
  } catch (error) {
    console.error(error);
    res.redirect("/track-screen-time");
  }
};

const deleteScreenTime = async (req, res) => {
  try {
    await ScreenTime.findOneAndDelete({
      _id: req.params.id,
      user: req.session.userId,
    });

    res.redirect("/track-screen-time");
  } catch (error) {
    console.error(error);
    res.redirect("/track-screen-time");
  }
};

module.exports = {
  getTrackPage,
  addScreenTime,
  saveTrackedSession,
  getEditScreenTimePage,
  updateScreenTime,
  deleteScreenTime,
};