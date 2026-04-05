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

const getStartOfMonth = (date = new Date()) => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const getEndOfMonth = (date = new Date()) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
};

const getLast7Days = () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const day = getStartOfDay(new Date());
    day.setDate(day.getDate() - i);
    days.push(day);
  }
  return days;
};

const escapeCsv = (value) => {
  const stringValue = String(value ?? "");
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const calculateProductivityScore = (entries) => {
  let score = 100;

  entries.forEach((entry) => {
    const hours = Number(entry.hours || 0);

    if (entry.category === "Study") {
      score += hours * 8;
    } else if (entry.category === "Social Media") {
      score -= hours * 10;
    } else if (entry.category === "Entertainment") {
      score -= hours * 7;
    } else if (entry.category === "Gaming") {
      score -= hours * 9;
    } else {
      score -= hours * 2;
    }
  });

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  return Number(score.toFixed(1));
};

const getProductivityLabel = (score) => {
  if (score >= 80) return "Highly Productive";
  if (score >= 60) return "Balanced";
  if (score >= 40) return "Needs Improvement";
  return "Highly Distracted";
};

const buildCategoryTotals = (entries) => {
  const totals = {
    "Social Media": 0,
    Entertainment: 0,
    Study: 0,
    Gaming: 0,
    Other: 0
  };

  entries.forEach((entry) => {
    if (totals[entry.category] !== undefined) {
      totals[entry.category] += entry.hours || 0;
    } else {
      totals.Other += entry.hours || 0;
    }
  });

  return totals;
};

const buildTopWebsites = (entries, limit = 10) => {
  const map = {};

  entries
    .filter((entry) => entry.source === "extension")
    .forEach((entry) => {
      const key = entry.domain || "Unknown";

      if (!map[key]) {
        map[key] = {
          domain: key,
          totalHours: 0,
          visits: 0,
          category: entry.category || "Other",
          lastTitle: entry.title || "N/A"
        };
      }

      map[key].totalHours += entry.hours || 0;
      map[key].visits += 1;

      if (entry.title) {
        map[key].lastTitle = entry.title;
      }
    });

  return Object.values(map)
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, limit)
    .map((site) => ({
      ...site,
      totalHours: formatHours(site.totalHours)
    }));
};

const getWeeklyReportPage = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect("/login");
    }

    const last7Days = getLast7Days();
    const weeklyRows = [];
    const weeklyChartLabels = [];
    const weeklyChartData = [];

    let weeklyEntries = [];

    for (const day of last7Days) {
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayEntries = await ScreenTime.find({
        user: req.session.userId,
        date: { $gte: day, $lt: nextDay }
      }).sort({ createdAt: -1 });

      const total = dayEntries.reduce((sum, entry) => sum + entry.hours, 0);

      weeklyEntries = weeklyEntries.concat(dayEntries);

      const label = day.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short"
      });

      weeklyRows.push({
        label,
        total: formatHours(total),
        sessions: dayEntries.length
      });

      weeklyChartLabels.push(
        day.toLocaleDateString("en-IN", { weekday: "short" })
      );
      weeklyChartData.push(formatHours(total));
    }

    const weeklyTotal = weeklyRows.reduce((sum, row) => sum + row.total, 0);
    const weeklyAverage = weeklyTotal / 7;

    const weeklyCategoryTotals = buildCategoryTotals(weeklyEntries);
    const topCategory = CATEGORY_KEYS.sort(
      (a, b) => weeklyCategoryTotals[b] - weeklyCategoryTotals[a]
    )[0] || "No data";

    const productivityScore = calculateProductivityScore(weeklyEntries);
    const productivityLabel = getProductivityLabel(productivityScore);

    const startOfMonth = getStartOfMonth();
    const endOfMonth = getEndOfMonth();

    const monthlyEntries = await ScreenTime.find({
      user: req.session.userId,
      date: { $gte: startOfMonth, $lt: endOfMonth }
    });

    const monthlyTotal = monthlyEntries.reduce(
      (sum, entry) => sum + entry.hours,
      0
    );

    const monthlyCategoryTotals = buildCategoryTotals(monthlyEntries);
    const topWebsites = buildTopWebsites(weeklyEntries, 5);

    const recentEntries = weeklyEntries
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 12);

    res.render("store/report", {
      userName: req.session.userName || user.name || null,
      weeklyRows,
      weeklyTotal: formatHours(weeklyTotal),
      weeklyAverage: formatHours(weeklyAverage),
      productivityScore,
      productivityLabel,
      monthlyTotal: formatHours(monthlyTotal),
      topCategory,
      weeklyCategoryTotals,
      monthlyCategoryTotals,
      weeklyChartLabels: JSON.stringify(weeklyChartLabels),
      weeklyChartData: JSON.stringify(weeklyChartData),
      topWebsites,
      recentEntries
    });
  } catch (error) {
    console.error("REPORT PAGE ERROR:", error);
    res.render("store/report", {
      userName: req.session.userName || null,
      weeklyRows: [],
      weeklyTotal: 0,
      weeklyAverage: 0,
      productivityScore: 0,
      productivityLabel: "Unavailable",
      monthlyTotal: 0,
      topCategory: "No data",
      weeklyCategoryTotals: {
        "Social Media": 0,
        Entertainment: 0,
        Study: 0,
        Gaming: 0,
        Other: 0
      },
      monthlyCategoryTotals: {
        "Social Media": 0,
        Entertainment: 0,
        Study: 0,
        Gaming: 0,
        Other: 0
      },
      weeklyChartLabels: JSON.stringify([]),
      weeklyChartData: JSON.stringify([]),
      topWebsites: [],
      recentEntries: []
    });
  }
};

const exportWeeklyCsv = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect("/login");
    }

    const start = getStartOfDay(new Date());
    start.setDate(start.getDate() - 6);

    const end = getEndOfDay(new Date());

    const entries = await ScreenTime.find({
      user: req.session.userId,
      date: { $gte: start, $lt: end }
    }).sort({ createdAt: -1 });

    const header = [
      "Date",
      "Created At",
      "Category",
      "Hours",
      "Source",
      "Domain",
      "Title",
      "URL",
      "Notes"
    ];

    const rows = entries.map((entry) => [
      new Date(entry.date).toLocaleDateString("en-IN"),
      new Date(entry.createdAt).toLocaleString("en-IN"),
      entry.category || "",
      formatHours(entry.hours || 0),
      entry.source || "",
      entry.domain || "",
      entry.title || "",
      entry.url || "",
      entry.notes || ""
    ]);

    const csv = [
      header.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(","))
    ].join("\n");

    const fileName = `weekly_report_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(csv);
  } catch (error) {
    console.error("CSV EXPORT ERROR:", error);
    return res.status(500).send("Failed to export CSV");
  }
};

module.exports = {
  getWeeklyReportPage,
  exportWeeklyCsv
};