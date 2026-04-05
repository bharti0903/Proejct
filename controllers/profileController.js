const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");

const ensureUserDefaults = async (user) => {
  let changed = false;

  if (user.dailyLimit === undefined || user.dailyLimit === null) {
    user.dailyLimit = 4;
    changed = true;
  }

  if (user.warningLimit === undefined || user.warningLimit === null) {
    user.warningLimit = 3;
    changed = true;
  }

  if (user.dangerLimit === undefined || user.dangerLimit === null) {
    user.dangerLimit = 4;
    changed = true;
  }

  if (!user.extensionToken) {
    user.extensionToken = crypto.randomBytes(24).toString("hex");
    changed = true;
  }

  if (changed) {
    await user.save();
  }

  return user;
};

const getProfilePage = async (req, res) => {
  try {
    let user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect("/login");
    }

    user = await ensureUserDefaults(user);

    res.render("store/profileSettings", {
      user,
      userName: req.session.userName || null,
      error: null,
      success: null,
    });
  } catch (error) {
    console.error(error);
    res.redirect("/");
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

    let user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect("/login");
    }

    user = await ensureUserDefaults(user);

    const trimmedName = name ? name.trim() : "";
    const parsedDailyLimit = Number(dailyLimit);

    const parsedWarningHours = Number(warningHours);
    const parsedWarningMinutes = Number(warningMinutes);

    const parsedDangerHours = Number(dangerHours);
    const parsedDangerMinutes = Number(dangerMinutes);

    const warningLimit = parsedWarningHours + parsedWarningMinutes / 60;
    const dangerLimit = parsedDangerHours + parsedDangerMinutes / 60;

    if (!trimmedName) {
      return res.render("store/profileSettings", {
        user,
        userName: req.session.userName || null,
        error: "Name is required",
        success: null,
      });
    }

    if (!parsedDailyLimit || parsedDailyLimit < 1 || parsedDailyLimit > 24) {
      return res.render("store/profileSettings", {
        user,
        userName: req.session.userName || null,
        error: "Daily limit must be between 1 and 24 hours",
        success: null,
      });
    }

    if (
      Number.isNaN(parsedWarningHours) ||
      Number.isNaN(parsedWarningMinutes) ||
      parsedWarningHours < 0 ||
      parsedWarningMinutes < 0 ||
      parsedWarningMinutes > 59
    ) {
      return res.render("store/profileSettings", {
        user,
        userName: req.session.userName || null,
        error: "Warning threshold must have valid hours and minutes",
        success: null,
      });
    }

    if (
      Number.isNaN(parsedDangerHours) ||
      Number.isNaN(parsedDangerMinutes) ||
      parsedDangerHours < 0 ||
      parsedDangerMinutes < 0 ||
      parsedDangerMinutes > 59
    ) {
      return res.render("store/profileSettings", {
        user,
        userName: req.session.userName || null,
        error: "Danger threshold must have valid hours and minutes",
        success: null,
      });
    }

    if (warningLimit <= 0 || warningLimit > 24) {
      return res.render("store/profileSettings", {
        user,
        userName: req.session.userName || null,
        error: "Warning threshold must be between 1 minute and 24 hours",
        success: null,
      });
    }

    if (dangerLimit <= 0 || dangerLimit > 24) {
      return res.render("store/profileSettings", {
        user,
        userName: req.session.userName || null,
        error: "Danger threshold must be between 1 minute and 24 hours",
        success: null,
      });
    }

    if (warningLimit >= dangerLimit) {
      return res.render("store/profileSettings", {
        user,
        userName: req.session.userName || null,
        error: "Warning threshold must be less than danger threshold",
        success: null,
      });
    }

    if (dangerLimit > parsedDailyLimit) {
      return res.render("store/profileSettings", {
        user,
        userName: req.session.userName || null,
        error: "Danger threshold cannot be greater than daily limit",
        success: null,
      });
    }

    user.name = trimmedName;
    user.dailyLimit = parsedDailyLimit;
    user.warningLimit = Number(warningLimit.toFixed(2));
    user.dangerLimit = Number(dangerLimit.toFixed(2));

    await user.save();

    req.session.userName = user.name;

    res.render("store/profileSettings", {
      user,
      userName: req.session.userName || null,
      error: null,
      success: "Profile settings updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.redirect("/profile-settings");
  }
};

const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    let user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect("/login");
    }

    user = await ensureUserDefaults(user);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.render("store/profileSettings", {
        user,
        userName: req.session.userName || null,
        error: "All password fields are required",
        success: null,
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.render("store/profileSettings", {
        user,
        userName: req.session.userName || null,
        error: "Current password is incorrect",
        success: null,
      });
    }

    if (newPassword.length < 6) {
      return res.render("store/profileSettings", {
        user,
        userName: req.session.userName || null,
        error: "New password must be at least 6 characters long",
        success: null,
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.render("store/profileSettings", {
        user,
        userName: req.session.userName || null,
        error: "New password and confirm password do not match",
        success: null,
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.render("store/profileSettings", {
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
    let user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect("/login");
    }

    user = await ensureUserDefaults(user);

    user.extensionToken = crypto.randomBytes(24).toString("hex");
    await user.save();

    return res.render("store/profileSettings", {
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