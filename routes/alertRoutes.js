const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  getSmartAlertsPage,
  saveSmartAlertThresholds
} = require("../controllers/alertController");

router.get("/smart-alerts", protect, getSmartAlertsPage);
router.post("/smart-alerts", protect, saveSmartAlertThresholds);

module.exports = router;