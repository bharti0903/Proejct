const express = require("express");
const router = express.Router();
const {
  saveExtensionData,
  getExtensionTodaySummary,
} = require("../controllers/extensionController");

router.post("/extension/track", saveExtensionData);
router.get("/extension/today-summary", getExtensionTodaySummary);

module.exports = router;