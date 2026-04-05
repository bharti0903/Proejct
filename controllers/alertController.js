const User = require("../models/User");
const ScreenTime = require("../models/ScreenTime");

function getUserId(req) {
  return req.session?.user?.id || req.user?._id || null;
}

function getStartOfToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

function getEndOfToday() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end;
}

exports.getSmartAlertsPage = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId);

    const todayStart = getStartOfToday();
    const todayEnd = getEndOfToday();

    const todayEntries = await ScreenTime.find({
      user: userId,
      date: { $gte: todayStart, $lte: todayEnd }
    });

    const todayUsage = todayEntries.reduce((sum, entry) => {
      return sum + Number(entry.hours || 0);
    }, 0);

    res.render("store/smartAlerts", {
      todayUsage,
      warningThreshold: user?.warningThreshold ?? 2,
      alertThreshold: user?.alertThreshold ?? 4,
      userId
    });
  } catch (error) {
    console.error("Error loading smart alerts page:", error);
    res.status(500).send("Server Error");
  }
};

exports.saveSmartAlertThresholds = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    let { warningThreshold, alertThreshold } = req.body;

    warningThreshold = Number(warningThreshold);
    alertThreshold = Number(alertThreshold);

    if (
      isNaN(warningThreshold) ||
      isNaN(alertThreshold) ||
      warningThreshold <= 0 ||
      alertThreshold <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Thresholds must be valid numbers greater than 0"
      });
    }

    if (warningThreshold >= alertThreshold) {
      return res.status(400).json({
        success: false,
        message: "Danger threshold must be greater than warning threshold"
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        warningThreshold,
        alertThreshold
      },
      { new: true }
    );

    return res.json({
      success: true,
      message: "Thresholds saved successfully",
      data: {
        warningThreshold: updatedUser.warningThreshold,
        alertThreshold: updatedUser.alertThreshold
      }
    });
  } catch (error) {
    console.error("Error saving smart alert thresholds:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};