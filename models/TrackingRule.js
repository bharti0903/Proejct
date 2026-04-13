const mongoose = require("mongoose");

const trackingRuleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pattern: {
      type: String,
      required: true,
      trim: true,
    },
    matchType: {
      type: String,
      enum: ["domain", "url", "title", "contains"],
      default: "domain",
    },
    category: {
      type: String,
      required: true,
      enum: ["Social Media", "Entertainment", "Study", "Gaming", "Other"],
    },
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.TrackingRule ||
  mongoose.model("TrackingRule", trackingRuleSchema);