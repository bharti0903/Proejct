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

// ─── Indexes ────────────────────────────────────────────────────────────────
//
// Every controller query filters by { user } and sorts/ranges on { date }.
// Without these, MongoDB does a full collection scan on every request.
// These two indexes cover ~95% of all queries in this app.

// Covers: getTrackPage, getEditScreenTimePage, addScreenTime,
//         dashboard today-entries, aggregation $match, alert checks
screenTimeSchema.index({ user: 1, date: -1 });

// Covers: dashboard + report extension-entry lookups (source: "extension")
screenTimeSchema.index({ user: 1, source: 1, date: -1 });

module.exports =
  mongoose.models.ScreenTime ||
  mongoose.model("ScreenTime", screenTimeSchema);