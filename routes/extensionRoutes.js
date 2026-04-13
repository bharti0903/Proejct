const express = require("express");
const router = express.Router();

const {
  getExtensionBootstrap,
  saveExtensionData,
  getExtensionTodaySummary,
} = require("../controllers/extensionController");

router.get("/extension/bootstrap", getExtensionBootstrap);
router.post("/extension/track", saveExtensionData);
router.get("/extension/today-summary", getExtensionTodaySummary);

module.exports = router;