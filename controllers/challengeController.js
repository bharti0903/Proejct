const Challenge = require("../models/Challenge");

const DEFAULT_CHALLENGES = [
  {
    title: "Social Media Detox",
    description: "Keep social media usage under 1 hour today.",
    targetHours: 1,
    category: "Social Media",
  },
  {
    title: "Study First",
    description: "Log at least one focused study session before entertainment.",
    targetHours: 1,
    category: "Study",
  },
  {
    title: "Gaming Limit",
    description: "Keep gaming below 1 hour and stay within your daily limit.",
    targetHours: 1,
    category: "Gaming",
  },
];

const ensureDefaultChallenges = async (userId) => {
  const count = await Challenge.countDocuments({ user: userId });
  if (count > 0) return;

  await Challenge.insertMany(
    DEFAULT_CHALLENGES.map((challenge) => ({
      ...challenge,
      user: userId,
      status: "active",
    }))
  );
};

const getChallengesPage = async (req, res) => {
  await ensureDefaultChallenges(req.session.userId);
  const challenges = await Challenge.find({ user: req.session.userId }).sort({ createdAt: -1 });
  res.render("store/challenges", { challenges });
};

const createChallenge = async (req, res) => {
  try {
    const { title, description, targetHours, category } = req.body;

    if (!title || !String(title).trim()) {
      return res.redirect("/challenges");
    }

    await Challenge.create({
      user: req.session.userId,
      title: String(title).trim(),
      description: description ? String(description).trim() : "",
      targetHours: Number(targetHours) >= 0 ? Number(targetHours) : 1,
      category: category || "Any",
      status: "active",
    });

    return res.redirect("/challenges");
  } catch (error) {
    console.error("CREATE CHALLENGE ERROR:", error);
    return res.redirect("/challenges");
  }
};

const updateChallengeStatus = async (req, res) => {
  try {
    const allowedStatuses = ["active", "completed", "failed"];
    const status = allowedStatuses.includes(req.body.status) ? req.body.status : "active";

    await Challenge.findOneAndUpdate(
      { _id: req.params.id, user: req.session.userId },
      { status }
    );

    return res.redirect("/challenges");
  } catch (error) {
    console.error("UPDATE CHALLENGE ERROR:", error);
    return res.redirect("/challenges");
  }
};

const deleteChallenge = async (req, res) => {
  try {
    await Challenge.findOneAndDelete({
      _id: req.params.id,
      user: req.session.userId,
    });

    return res.redirect("/challenges");
  } catch (error) {
    console.error("DELETE CHALLENGE ERROR:", error);
    return res.redirect("/challenges");
  }
};

module.exports = {
  getChallengesPage,
  createChallenge,
  updateChallengeStatus,
  deleteChallenge,
};
