const express = require("express");
const router = express.Router();
const {
  startLiveSession,
  stopLiveSession,
  getLiveSessionStatus,
} = require("../controllers/liveSessionController");

router.post("/start", startLiveSession);
router.post("/stop", stopLiveSession);
router.get("/status", getLiveSessionStatus);

module.exports = router;