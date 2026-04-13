const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { getWeeklyReportPage, exportWeeklyCsv } = require("../controllers/reportController");

router.get("/weekly-report", protect, getWeeklyReportPage);
router.get("/weekly-report/export-csv", protect, exportWeeklyCsv);

module.exports = router;