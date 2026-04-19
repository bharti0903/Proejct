const mongoose = require("mongoose");

const liveSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    stoppedAt: {
      type: Date,
      default: null,
    },
    source: {
      type: String,
      default: "manual",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LiveSession", liveSessionSchema);