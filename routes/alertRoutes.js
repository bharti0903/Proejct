const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getAlertsPage,
  getRecentAlertsApi,
  markAlertRead,
  markAllAlertsRead
} = require("../controllers/alertController");

router.get("/", protect, getAlertsPage);
router.get("/api/recent", protect, getRecentAlertsApi);
router.patch("/api/:id/read", protect, markAlertRead);
router.patch("/api/read-all", protect, markAllAlertsRead);

module.exports = router;