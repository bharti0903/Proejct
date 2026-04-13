const Challenge = require("../models/Challenge");

const getChallengesPage = async (req, res) => {
  const challenges = await Challenge.find({ user: req.session.userId }).sort({ createdAt: -1 });
  res.render("store/challenges", { challenges });
};

module.exports = { getChallengesPage };