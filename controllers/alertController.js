const Alert = require("../models/Alert");

// Alerts page
const getAlertsPage = async (req, res) => {
  try {
    const alerts = await Alert.find({ user: req.session.userId })
      .sort({ createdAt: -1 });

    res.render("store/alerts", { alerts });
  } catch (error) {
    console.error("GET ALERT PAGE ERROR:", error);
    res.status(500).send("Server Error");
  }
};

// Bell notification API
const getRecentAlertsApi = async (req, res) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not logged in"
      });
    }

    const alerts = await Alert.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10);

    const unreadCount = await Alert.countDocuments({
      user: userId,
      isRead: false
    });

    res.json({
      success: true,
      alerts,
      unreadCount
    });
  } catch (error) {
    console.error("GET RECENT ALERTS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load alerts"
    });
  }
};

// Mark single alert as read
const markAlertRead = async (req, res) => {
  try {
    const userId = req.session?.userId;
    const alertId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not logged in"
      });
    }

    const alert = await Alert.findOneAndUpdate(
      { _id: alertId, user: userId },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found"
      });
    }

    const unreadCount = await Alert.countDocuments({
      user: userId,
      isRead: false
    });

    res.json({
      success: true,
      alert,
      unreadCount
    });
  } catch (error) {
    console.error("MARK ALERT READ ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to mark alert as read"
    });
  }
};

// Mark all alerts as read
const markAllAlertsRead = async (req, res) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not logged in"
      });
    }

    await Alert.updateMany(
      { user: userId, isRead: false },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    res.json({
      success: true,
      unreadCount: 0
    });
  } catch (error) {
    console.error("MARK ALL ALERTS READ ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to mark all alerts as read"
    });
  }
};

module.exports = {
  getAlertsPage,
  getRecentAlertsApi,
  markAlertRead,
  markAllAlertsRead
};