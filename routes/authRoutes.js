const express = require("express");
const router = express.Router();

const {
  getLoginPage,
  loginUser,
  getSignupPage,
  signupUser,
  logoutUser,
} = require("../controllers/authController");

router.get("/login", getLoginPage);
router.post("/login", loginUser);

router.get("/signup", getSignupPage);
router.post("/signup", signupUser);

router.get("/logout", logoutUser);

module.exports = router;