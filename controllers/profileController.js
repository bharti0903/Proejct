const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const TrackingRule = require("../models/TrackingRule");

const getTrackingRules = async (userId) => {
  return TrackingRule.find({ user: userId }).sort({ createdAt: -1 });
};

const roundLimitHours = (value) => Number(Number(value).toFixed(6));

const getProfilePage = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.redirect("/login");
    }

    const trackingRules = await getTrackingRules(req.session.userId);

    return res.render("store/profileSettings", {
      user,
      trackingRules,
      userName: req.session.userName || null,
      error: null,
      success: null,
    });
  } catch (error) {
    console.error("GET PROFILE PAGE ERROR:", error);
    return res.redirect("/dashboard");
  }
};

const updateProfile = async (req, res) => {
  try {
    const {
      name,
      dailyLimit,
      warningHours,
      warningMinutes,
      dangerHours,
      dangerMinutes,
    } = req.body;

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.redirect("/login");
    }

    const trackingRules = await getTrackingRules(req.session.userId);

    const parsedDailyLimit = Number(dailyLimit);
    const parsedWarningHours = Number(warningHours || 0);
    const parsedWarningMinutes = Number(warningMinutes || 0);
    const parsedDangerHours = Number(dangerHours || 0);
    const parsedDangerMinutes = Number(dangerMinutes || 0);

    const warningLimit = parsedWarningHours + parsedWarningMinutes / 60;
    const dangerLimit = parsedDangerHours + parsedDangerMinutes / 60;

    if (!name || !String(name).trim()) {
      return res.render("store/profileSettings", {
        user,
        trackingRules,
        userName: req.session.userName || null,
        error: "Name is required",
        success: null,
      });
    }

    if (!parsedDailyLimit || parsedDailyLimit < 1 || parsedDailyLimit > 24) {
      return res.render("store/profileSettings", {
        user,
        trackingRules,
        userName: req.session.userName || null,
        error: "Daily limit must be between 1 and 24 hours",
        success: null,
      });
    }

    if (warningLimit <= 0 || warningLimit > 24) {
      return res.render("store/profileSettings", {
        user,
        trackingRules,
        userName: req.session.userName || null,
        error: "Warning threshold must be between 1 minute and 24 hours",
        success: null,
      });
    }

    if (dangerLimit <= 0 || dangerLimit > 24) {
      return res.render("store/profileSettings", {
        user,
        trackingRules,
        userName: req.session.userName || null,
        error: "Danger threshold must be between 1 minute and 24 hours",
        success: null,
      });
    }

    if (warningLimit >= dangerLimit) {
      return res.render("store/profileSettings", {
        user,
        trackingRules,
        userName: req.session.userName || null,
        error: "Warning threshold must be less than danger threshold",
        success: null,
      });
    }

    if (dangerLimit > parsedDailyLimit) {
      return res.render("store/profileSettings", {
        user,
        trackingRules,
        userName: req.session.userName || null,
        error: "Danger threshold cannot be greater than daily limit",
        success: null,
      });
    }

    user.name = String(name).trim();
    user.dailyLimit = parsedDailyLimit;
    user.warningLimit = roundLimitHours(warningLimit);
    user.dangerLimit = roundLimitHours(dangerLimit);

    await user.save();
    req.session.userName = user.name;
    req.session.profileSuccess = "Profile updated successfully";

    return res.redirect("/track-screen-time");
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    return res.redirect("/profile-settings");
  }
};

const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.redirect("/login");
    }

    const trackingRules = await getTrackingRules(req.session.userId);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.render("store/profileSettings", {
        user,
        trackingRules,
        userName: req.session.userName || null,
        error: "All password fields are required",
        success: null,
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.render("store/profileSettings", {
        user,
        trackingRules,
        userName: req.session.userName || null,
        error: "Current password is incorrect",
        success: null,
      });
    }

    if (newPassword.length < 6) {
      return res.render("store/profileSettings", {
        user,
        trackingRules,
        userName: req.session.userName || null,
        error: "New password must be at least 6 characters long",
        success: null,
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.render("store/profileSettings", {
        user,
        trackingRules,
        userName: req.session.userName || null,
        error: "New password and confirm password do not match",
        success: null,
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.render("store/profileSettings", {
      user,
      trackingRules,
      userName: req.session.userName || null,
      error: null,
      success: "Password updated successfully",
    });
  } catch (error) {
    console.error("UPDATE PASSWORD ERROR:", error);
    return res.redirect("/profile-settings");
  }
};

const regenerateExtensionToken = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.redirect("/login");
    }

    const trackingRules = await getTrackingRules(req.session.userId);

    user.extensionToken = crypto.randomBytes(24).toString("hex");
    await user.save();

    return res.render("store/profileSettings", {
      user,
      trackingRules,
      userName: req.session.userName || null,
      error: null,
      success: "Extension token regenerated successfully",
    });
  } catch (error) {
    console.error("REGENERATE TOKEN ERROR:", error);
    return res.redirect("/profile-settings");
  }
};

module.exports = {
  getProfilePage,
  updateProfile,
  updatePassword,
  regenerateExtensionToken,
};
