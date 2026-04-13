const ScreenTime = require("../models/ScreenTime");
const User = require("../models/User");

const CATEGORY_KEYS = ["Social Media", "Entertainment", "Study", "Gaming", "Other"];

const formatHours = (value) => Number((value || 0).toFixed(4));

const getStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getUsageStatus = (todayTotal, user) => {
  if (todayTotal >= user.dangerLimit) return "Limit Reached";
  if (todayTotal >= user.warningLimit) return "Approaching Limit";
  return "Healthy";
};

const getDashboardPage = async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await User.findById(userId).lean();

    if (!user) return res.redirect("/login");

    const startOfToday = getStartOfDay();
    const weekStart = getStartOfDay();
    weekStart.setDate(weekStart.getDate() - 6);

    // ─── All data in 3 parallel queries instead of 9+ sequential ones ───────

    const [todayEntries, weeklyAgg, extensionEntries] = await Promise.all([

      // 1. Today's full entries (needed for category chart + session count)
      ScreenTime.find({
        user: userId,
        date: { $gte: startOfToday },
      }).lean(),

      // 2. Daily totals for the past 7 days — ONE query replacing the for-loop
      ScreenTime.aggregate([
        {
          $match: {
            user: user._id,           // use ObjectId, not string
            date: { $gte: weekStart },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$date" },
            },
            total: { $sum: "$hours" },
            sessions: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 3. Extension entries for top-websites + recent activity
      ScreenTime.find({
        user: userId,
        source: "extension",
      })
        .sort({ createdAt: -1 })
        .limit(100)   // cap at 100 — enough for top-5 websites + 8 recent
        .lean(),
    ]);

    // ─── Today stats ─────────────────────────────────────────────────────────

    const todayTotal = todayEntries.reduce((sum, e) => sum + e.hours, 0);
    const timeLeft = Math.max(user.dailyLimit - todayTotal, 0);

    const categoryTotals = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]));
    todayEntries.forEach((e) => {
      if (categoryTotals[e.category] !== undefined) {
        categoryTotals[e.category] += e.hours;
      } else {
        categoryTotals.Other += e.hours;
      }
    });

    const categoryChartLabels = CATEGORY_KEYS;
    const categoryChartData = CATEGORY_KEYS.map((k) => formatHours(categoryTotals[k]));

    let mostUsedCategory = "No data";
    let mostUsedCategoryHours = 0;
    CATEGORY_KEYS.forEach((k) => {
      if (categoryTotals[k] > mostUsedCategoryHours) {
        mostUsedCategoryHours = categoryTotals[k];
        mostUsedCategory = k;
      }
    });

    // ─── Weekly chart — built from aggregation result ─────────────────────────

    // Turn the aggregation result into a map keyed by "YYYY-MM-DD"
    const aggByDay = Object.fromEntries(weeklyAgg.map((r) => [r._id, r]));

    const weeklyChartLabels = [];
    const weeklyChartData = [];
    const weeklyBreakdown = [];

    for (let i = 6; i >= 0; i--) {
      const day = getStartOfDay();
      day.setDate(day.getDate() - i);

      const key = day.toISOString().slice(0, 10);   // "YYYY-MM-DD"
      const total = aggByDay[key]?.total || 0;

      weeklyChartLabels.push(day.toLocaleDateString("en-IN", { weekday: "short" }));
      weeklyChartData.push(formatHours(total));
      weeklyBreakdown.push({
        label: day.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "short",
        }),
        total: formatHours(total),
      });
    }

    const weeklyTotal = weeklyChartData.reduce((s, v) => s + v, 0);
    const weeklyAverage = weeklyTotal / 7;

    // ─── Top websites + recent activity from extension entries ────────────────

    const websiteMap = {};
    extensionEntries.forEach((e) => {
      const key = e.domain || "Unknown";
      if (!websiteMap[key]) {
        websiteMap[key] = {
          domain: key,
          totalHours: 0,
          visits: 0,
          lastTitle: e.title || "N/A",
          category: e.category || "Other",
        };
      }
      websiteMap[key].totalHours += e.hours || 0;
      websiteMap[key].visits += 1;
      if (e.title) websiteMap[key].lastTitle = e.title;
    });

    const topWebsites = Object.values(websiteMap)
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 5)
      .map((s) => ({ ...s, totalHours: formatHours(s.totalHours) }));

    const recentExtensionActivity = extensionEntries.slice(0, 8).map((e) => ({
      domain: e.domain || "N/A",
      title: e.title || "N/A",
      url: e.url || "N/A",
      category: e.category || "Other",
      hours: formatHours(e.hours || 0),
      createdAt: e.createdAt,
    }));

    // ─── Render ───────────────────────────────────────────────────────────────

    const progressPercent =
      user.dailyLimit > 0 ? Math.min((todayTotal / user.dailyLimit) * 100, 100) : 0;

    res.render("store/dashboard", {
      userName: req.session.userName || user.name || null,
      user,
      todayTotal: formatHours(todayTotal),
      timeLeft: formatHours(timeLeft),
      dailyLimit: user.dailyLimit,
      warningLimit: user.warningLimit,
      dangerLimit: user.dangerLimit,
      usageStatus: getUsageStatus(todayTotal, user),
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
      weeklyBreakdown,
      error: null,
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
      error: "Could not load dashboard",
    });
  }
};

module.exports = { getDashboardPage };