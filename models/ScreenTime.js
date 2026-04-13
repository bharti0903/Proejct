const mongoose = require("mongoose");

const screenTimeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["Social Media", "Entertainment", "Study", "Gaming", "Other"],
    },
    hours: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      default: "",
    },
    domain: {
      type: String,
      default: "",
      trim: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    url: {
      type: String,
      default: "",
      trim: true,
    },
    source: {
      type: String,
      enum: ["manual", "live-session", "extension"],
      default: "manual",
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ScreenTime ||
  mongoose.model("ScreenTime", screenTimeSchema);