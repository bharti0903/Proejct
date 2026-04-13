const mongoose = require("mongoose");

const challengeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    targetHours: {
      type: Number,
      default: 1,
      min: 0,
    },
    category: {
      type: String,
      enum: ["Social Media", "Entertainment", "Study", "Gaming", "Other", "Any"],
      default: "Any",
    },
    status: {
      type: String,
      enum: ["active", "completed", "failed"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Challenge || mongoose.model("Challenge", challengeSchema);