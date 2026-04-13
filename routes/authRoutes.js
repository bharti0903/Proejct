const express = require("express");
const router = express.Router();

const {
  getLoginPage,
  getSignupPage,
  signup,
  login,
  logout,
} = require("../controllers/authController");

router.get("/login", getLoginPage);
router.get("/signup", getSignupPage);
router.post("/signup", signup);
router.post("/login", login);
router.get("/logout", logout);

module.exports = router;