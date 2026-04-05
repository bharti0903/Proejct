const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  getProfilePage,
  updateProfile,
  updatePassword,
  regenerateExtensionToken,
} = require("../controllers/profileController");

router.get("/profile-settings", protect, getProfilePage);
router.post("/profile-settings/update", protect, updateProfile);
router.post("/profile-settings/password", protect, updatePassword);
router.post(
  "/profile-settings/regenerate-extension-token",
  protect,
  regenerateExtensionToken
);

module.exports = router;