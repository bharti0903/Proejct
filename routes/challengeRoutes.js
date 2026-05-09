const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getChallengesPage,
  createChallenge,
  updateChallengeStatus,
  deleteChallenge,
} = require("../controllers/challengeController");

router.get("/challenges", protect, getChallengesPage);
router.post("/challenges", protect, createChallenge);
router.post("/challenges/:id/status", protect, updateChallengeStatus);
router.post("/challenges/:id/delete", protect, deleteChallenge);

module.exports = router;
