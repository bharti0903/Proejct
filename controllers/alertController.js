const Alert = require("../models/Alert");

const getAlertsPage = async (req, res) => {
  const alerts = await Alert.find({ user: req.session.userId }).sort({ createdAt: -1 });
  res.render("store/alerts", { alerts });
};

module.exports = { getAlertsPage };