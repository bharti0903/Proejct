const Challenge = require("../models/Challenge");
const Alert = require("../models/Alert");
const { getIO } = require("../sockets");

const seedDefaultChallenges = async () => {
  const count = await Challenge.countDocuments();

  if (count === 0) {
    await Challenge.insertMany([
      {
        title: "3-Day Social Media Detox",
        description: "Avoid unnecessary social media scrolling for 3 days.",
        targetDays: 3,
      },
      {
        title: "5-Day Night Screen Cut",
        description: "Do not use screens 1 hour before sleep for 5 days.",
        targetDays: 5,
      },
      {
        title: "7-Day Mindful Usage Challenge",
        description: "Track and reduce non-productive screen time for 7 days.",
        targetDays: 7,
      },
    ]);
  }
};

const getChallengesPage = async (req, res) => {
  try {
    await seedDefaultChallenges();

    const challenges = await Challenge.find().sort({ createdAt: -1 });

    res.render("store/detoxChallenges", {
      userName: req.session.userName || null,
      challenges,
      success: null,
      error: null,
      currentUserId: req.session.userId,
    });
  } catch (error) {
    console.error(error);
    res.render("store/detoxChallenges", {
      userName: req.session.userName || null,
      challenges: [],
      success: null,
      error: "Could not load challenges",
      currentUserId: req.session.userId,
    });
  }
};

const joinChallenge = async (req, res) => {
  try {
    const { challengeId } = req.body;

    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      return res.redirect("/detox-challenges");
    }

    const alreadyJoined = challenge.participants.some(
      (participant) => participant.user.toString() === req.session.userId
    );

    if (!alreadyJoined) {
      challenge.participants.push({
        user: req.session.userId,
        progressDays: 0,
        completed: false,
      });

      await challenge.save();

      await Alert.create({
        user: req.session.userId,
        message: `You joined the challenge: ${challenge.title}`,
        type: "info",
      });

      getIO().emit("screenTimeUpdated", {
        userId: req.session.userId,
        message: "Challenge joined",
      });
    }

    const challenges = await Challenge.find().sort({ createdAt: -1 });

    res.render("store/detoxChallenges", {
      userName: req.session.userName || null,
      challenges,
      success: "Challenge joined successfully",
      error: null,
      currentUserId: req.session.userId,
    });
  } catch (error) {
    console.error(error);
    const challenges = await Challenge.find().sort({ createdAt: -1 });

    res.render("store/detoxChallenges", {
      userName: req.session.userName || null,
      challenges,
      success: null,
      error: "Could not join challenge",
      currentUserId: req.session.userId,
    });
  }
};

const updateChallengeProgress = async (req, res) => {
  try {
    const { challengeId } = req.body;

    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      return res.redirect("/detox-challenges");
    }

    const participant = challenge.participants.find(
      (p) => p.user.toString() === req.session.userId
    );

    if (participant && !participant.completed) {
      participant.progressDays += 1;

      if (participant.progressDays >= challenge.targetDays) {
        participant.completed = true;

        await Alert.create({
          user: req.session.userId,
          message: `Congratulations! You completed the challenge: ${challenge.title}`,
          type: "info",
        });
      }

      await challenge.save();

      getIO().emit("screenTimeUpdated", {
        userId: req.session.userId,
        message: "Challenge progress updated",
      });
    }

    const challenges = await Challenge.find().sort({ createdAt: -1 });

    res.render("store/detoxChallenges", {
      userName: req.session.userName || null,
      challenges,
      success: "Challenge progress updated",
      error: null,
      currentUserId: req.session.userId,
    });
  } catch (error) {
    console.error(error);
    const challenges = await Challenge.find().sort({ createdAt: -1 });

    res.render("store/detoxChallenges", {
      userName: req.session.userName || null,
      challenges,
      success: null,
      error: "Could not update progress",
      currentUserId: req.session.userId,
    });
  }
};

module.exports = {
  getChallengesPage,
  joinChallenge,
  updateChallengeProgress,
};