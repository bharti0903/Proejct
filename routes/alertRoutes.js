const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getAlertsPage } = require("../controllers/alertController");

router.get("/alerts", protect, getAlertsPage);

module.exports = router;