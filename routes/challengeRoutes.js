const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getChallengesPage } = require("../controllers/challengeController");

router.get("/challenges", protect, getChallengesPage);

module.exports = router;