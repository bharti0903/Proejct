const mongoose = require("mongoose");

const focusSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 720,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    blockedSites: {
      type: [String],
      default: [],
    },
    allowedSites: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "completed", "stopped", "expired"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FocusSession", focusSessionSchema);