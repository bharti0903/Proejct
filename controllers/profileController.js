const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");

const getProfilePage = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect("/login");

    res.render("store/profileSettings", {
      user,
      userName: req.session.userName || null,
      error: null,
      success: null,
    });
  } catch (error) {
    console.error(error);
    res.redirect("/dashboard");
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, dailyLimit, warningHours, warningMinutes, dangerHours, dangerMinutes } = req.body;
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect("/login");

    const warningLimit = Number(warningHours) + Number(warningMinutes || 0) / 60;
    const dangerLimit = Number(dangerHours) + Number(dangerMinutes || 0) / 60;

    user.name = String(name).trim();
    user.dailyLimit = Number(dailyLimit);
    user.warningLimit = Number(warningLimit.toFixed(2));
    user.dangerLimit = Number(dangerLimit.toFixed(2));

    await user.save();
    req.session.userName = user.name;

    res.render("store/profileSettings", {
      user,
      userName: req.session.userName || null,
      error: null,
      success: "Profile updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.redirect("/profile-settings");
  }
};

const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect("/login");

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.render("store/profileSettings", {
        user,
        userName: req.session.userName || null,
        error: "Current password is incorrect",
        success: null,
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.render("store/profileSettings", {
        user,
        userName: req.session.userName || null,
        error: "Passwords do not match",
        success: null,
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.render("store/profileSettings", {
      user,
      userName: req.session.userName || null,
      error: null,
      success: "Password updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.redirect("/profile-settings");
  }
};

const regenerateExtensionToken = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect("/login");

    user.extensionToken = crypto.randomBytes(24).toString("hex");
    await user.save();

    res.render("store/profileSettings", {
      user,
      userName: req.session.userName || null,
      error: null,
      success: "Extension token regenerated successfully",
    });
  } catch (error) {
    console.error(error);
    res.redirect("/profile-settings");
  }
};

module.exports = {
  getProfilePage,
  updateProfile,
  updatePassword,
  regenerateExtensionToken,
};