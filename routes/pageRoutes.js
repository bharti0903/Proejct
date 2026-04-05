const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

router.get("/", (req, res) => {
  res.render("store/homePage", {
    todayTotal: 0,
    timeLeft: 0,
    mostUsedCategory: "No Data",
    productivityScore: 0,
    usageStatus: "Healthy",
    currentStreak: 0,
    dailyLimit: 8,
    progressPercent: 0,
    warningLimit: 6,
    dangerLimit: 8,
    bestStreak: 0,
    recentEntries: [],
    chartLabels: [],
    chartData: [],
    userId: null
  });
});

router.get("/dashboard", protect, (req, res) => {
  res.render("store/dashboard");
});

router.get("/focus-mode", protect, (req, res) => {
  res.render("store/focusMode");
});

router.get("/track-screen-time", protect, (req, res) => {
  res.render("store/trackScreenTime");
});

router.get("/smart-alerts", protect, (req, res) => {
  res.render("store/smartAlerts");
});

router.get("/detox-challenges", protect, (req, res) => {
  res.render("store/detoxChallenges");
});

router.get("/profile-settings", protect, (req, res) => {
  res.render("store/profileSettings");
});

router.get("/report", protect, (req, res) => {
  res.render("store/report");
});

router.get("/weekly-report", protect, (req, res) => {
  res.render("store/weeklyReport");
});

module.exports = router;