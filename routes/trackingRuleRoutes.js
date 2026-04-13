const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  addTrackingRule,
  deleteTrackingRule,
} = require("../controllers/trackingRuleController");

router.post("/tracking-rules/add", protect, addTrackingRule);
router.post("/tracking-rules/delete/:id", protect, deleteTrackingRule);

module.exports = router;