const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { getDashboardPage } = require("../controllers/dashboardController");

router.get("/dashboard", protect, getDashboardPage);

module.exports = router;
console.log("dashboardRoutes loaded");