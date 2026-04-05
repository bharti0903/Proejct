const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { exportWeeklyCsv } = require("../controllers/reportController");

const defaultReportData = (req) => ({
  weeklyTotal: 0,
  weeklyAverage: 0,
  productivityScore: 0,
  productivityLabel: "Average",
  topCategory: "No Data",

  weeklyCategoryTotals: {
    "Social Media": 0,
    "Entertainment": 0,
    "Study": 0,
    "Gaming": 0,
    "Other": 0
  },

  monthlyTotal: 0,
  monthlyCategoryTotals: {
    "Social Media": 0,
    "Entertainment": 0,
    "Study": 0,
    "Gaming": 0,
    "Other": 0
  },

  topWebsites: [],
  weeklyRows: [],
  recentEntries: [],

  weeklyChartLabels: JSON.stringify([]),
  weeklyChartData: JSON.stringify([]),

  userId: req.session?.user?.id || null
});

router.get("/report", protect, (req, res) => {
  res.render("store/report", defaultReportData(req));
});

router.get("/weekly-report", protect, (req, res) => {
  res.render("store/weeklyReport", defaultReportData(req));
});

router.get("/reports/export-csv", protect, exportWeeklyCsv);

module.exports = router;