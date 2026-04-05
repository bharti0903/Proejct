const ScreenTime = require("../models/ScreenTime");
const User = require("../models/User");

const CATEGORY_KEYS = [
  "Social Media",
  "Entertainment",
  "Study",
  "Gaming",
  "Other"
];

const formatHours = (value) => Number((value || 0).toFixed(4));

const getStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfDay = (date = new Date()) => {
  const d = getStartOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
};

const getLast7Days = () => {
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = getStartOfDay(new Date());
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  return days;
};

const getUsageStatus = (todayTotal, user) => {
  if (todayTotal >= user.dangerLimit) return "Limit Reached";
  if (todayTotal >= user.warningLimit) return "Approaching Limit";
  return "Healthy";
};

const getDashboardPage = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect("/login");
    }

    const allEntries = await ScreenTime.find({
      user: req.session.userId
    }).sort({ createdAt: -1 });

    const startOfToday = getStartOfDay();
    const endOfToday = getEndOfDay();

    const todayEntries = await ScreenTime.find({
      user: req.session.userId,
      date: { $gte: startOfToday, $lt: endOfToday }
    }).sort({ createdAt: -1 });

    const todayTotal = todayEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const todayTotalRounded = formatHours(todayTotal);
    const timeLeft = Math.max(user.dailyLimit - todayTotal, 0);

    const categoryTotals = {
      "Social Media": 0,
      Entertainment: 0,
      Study: 0,
      Gaming: 0,
      Other: 0
    };

    todayEntries.forEach((entry) => {
      if (categoryTotals[entry.category] !== undefined) {
        categoryTotals[entry.category] += entry.hours;
      } else {
        categoryTotals.Other += entry.hours;
      }
    });

    const categoryChartLabels = CATEGORY_KEYS;
    const categoryChartData = CATEGORY_KEYS.map((key) =>
      formatHours(categoryTotals[key] || 0)
    );

    let mostUsedCategory = "No data";
    let mostUsedCategoryHours = 0;

    CATEGORY_KEYS.forEach((key) => {
      if (categoryTotals[key] > mostUsedCategoryHours) {
        mostUsedCategoryHours = categoryTotals[key];
        mostUsedCategory = key;
      }
    });

    const last7Days = getLast7Days();
    const weeklyChartLabels = [];
    const weeklyChartData = [];
    const weeklyBreakdown = [];

    for (const day of last7Days) {
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayEntries = await ScreenTime.find({
        user: req.session.userId,
        date: { $gte: day, $lt: nextDay }
      });

      const total = dayEntries.reduce((sum, entry) => sum + entry.hours, 0);

      const dayLabel = day.toLocaleDateString("en-IN", {
        weekday: "short"
      });

      weeklyChartLabels.push(dayLabel);
      weeklyChartData.push(formatHours(total));
      weeklyBreakdown.push({
        label: day.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "short"
        }),
        total: formatHours(total)
      });
    }

    const weeklyTotal = weeklyChartData.reduce((sum, value) => sum + value, 0);
    const weeklyAverage = weeklyTotal / 7;

    const extensionEntries = allEntries.filter(
      (entry) => entry.source === "extension"
    );

    const websiteMap = {};

    extensionEntries.forEach((entry) => {
      const key = entry.domain || "Unknown";
      if (!websiteMap[key]) {
        websiteMap[key] = {
          domain: key,
          totalHours: 0,
          visits: 0,
          lastTitle: entry.title || "N/A",
          category: entry.category || "Other"
        };
      }

      websiteMap[key].totalHours += entry.hours || 0;
      websiteMap[key].visits += 1;

      if (entry.title) {
        websiteMap[key].lastTitle = entry.title;
      }
    });

    const topWebsites = Object.values(websiteMap)
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 5)
      .map((site) => ({
        domain: site.domain,
        totalHours: formatHours(site.totalHours),
        visits: site.visits,
        lastTitle: site.lastTitle,
        category: site.category
      }));

    const recentExtensionActivity = extensionEntries.slice(0, 8).map((entry) => ({
      domain: entry.domain || "N/A",
      title: entry.title || "N/A",
      url: entry.url || "N/A",
      category: entry.category || "Other",
      hours: formatHours(entry.hours || 0),
      createdAt: entry.createdAt
    }));

    const progressPercent =
      user.dailyLimit > 0
        ? Math.min((todayTotal / user.dailyLimit) * 100, 100)
        : 0;

    const usageStatus = getUsageStatus(todayTotal, user);

    res.render("store/dashboard", {
      userName: req.session.userName || user.name || null,
      user,
      todayTotal: todayTotalRounded,
      timeLeft: formatHours(timeLeft),
      dailyLimit: user.dailyLimit,
      warningLimit: user.warningLimit,
      dangerLimit: user.dangerLimit,
      usageStatus,
      progressPercent: Number(progressPercent.toFixed(1)),
      mostUsedCategory,
      mostUsedCategoryHours: formatHours(mostUsedCategoryHours),
      todaySessionCount: todayEntries.length,
      weeklyTotal: formatHours(weeklyTotal),
      weeklyAverage: formatHours(weeklyAverage),
      categoryChartLabels: JSON.stringify(categoryChartLabels),
      categoryChartData: JSON.stringify(categoryChartData),
      weeklyChartLabels: JSON.stringify(weeklyChartLabels),
      weeklyChartData: JSON.stringify(weeklyChartData),
      topWebsites,
      recentExtensionActivity,
      weeklyBreakdown
    });
  } catch (error) {
    console.error("DASHBOARD ERROR:", error);
    res.render("store/dashboard", {
      userName: req.session.userName || null,
      user: null,
      todayTotal: 0,
      timeLeft: 0,
      dailyLimit: 0,
      warningLimit: 0,
      dangerLimit: 0,
      usageStatus: "Healthy",
      progressPercent: 0,
      mostUsedCategory: "No data",
      mostUsedCategoryHours: 0,
      todaySessionCount: 0,
      weeklyTotal: 0,
      weeklyAverage: 0,
      categoryChartLabels: JSON.stringify([]),
      categoryChartData: JSON.stringify([]),
      weeklyChartLabels: JSON.stringify([]),
      weeklyChartData: JSON.stringify([]),
      topWebsites: [],
      recentExtensionActivity: [],
      weeklyBreakdown: [],
      error: "Could not load dashboard"
    });
  }
};

module.exports = {
  getDashboardPage
};