const TrackingRule = require("../models/TrackingRule");

const addTrackingRule = async (req, res) => {
  try {
    const { pattern, matchType, category } = req.body;

    if (!pattern || !category) {
      return res.redirect("/profile-settings");
    }

    await TrackingRule.create({
      user: req.session.userId,
      pattern: String(pattern).trim().toLowerCase(),
      matchType: matchType || "domain",
      category,
      enabled: true,
    });

    return res.redirect("/profile-settings");
  } catch (error) {
    console.error("ADD RULE ERROR:", error);
    return res.redirect("/profile-settings");
  }
};

const deleteTrackingRule = async (req, res) => {
  try {
    await TrackingRule.findOneAndDelete({
      _id: req.params.id,
      user: req.session.userId,
    });

    return res.redirect("/profile-settings");
  } catch (error) {
    console.error("DELETE RULE ERROR:", error);
    return res.redirect("/profile-settings");
  }
};

module.exports = {
  addTrackingRule,
  deleteTrackingRule,
};