const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  getFocusModePage,
  startFocusSession,
  getActiveFocusSession,
  stopFocusSession,
} = require("../controllers/focusController");

router.get("/focus-mode", protect, getFocusModePage);
router.get("/focus-mode/active", protect, getActiveFocusSession);
router.post("/focus-mode/start", protect, startFocusSession);
router.post("/focus-mode/stop", protect, stopFocusSession);

module.exports = router;
console.log("focusRoutes loaded");