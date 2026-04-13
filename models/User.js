const mongoose = require("mongoose");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    dailyLimit: {
      type: Number,
      default: 4,
      min: 1,
      max: 24,
    },
    warningLimit: {
      type: Number,
      default: 3,
      min: 0.01,
      max: 24,
    },
    dangerLimit: {
      type: Number,
      default: 4,
      min: 0.01,
      max: 24,
    },
    currentStreak: {
      type: Number,
      default: 0,
    },
    bestStreak: {
      type: Number,
      default: 0,
    },
    lastStreakDate: {
      type: Date,
      default: null,
    },
    extensionToken: {
      type: String,
      unique: true,
      index: true,
      default: () => crypto.randomBytes(24).toString("hex"),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);