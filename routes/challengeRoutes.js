const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getChallengesPage,
  joinChallenge,
  updateChallengeProgress,
} = require("../controllers/challengeController");

router.get("/detox-challenges", protect, getChallengesPage);
router.post("/detox-challenges/join", protect, joinChallenge);
router.post("/detox-challenges/progress", protect, updateChallengeProgress);

module.exports = router;