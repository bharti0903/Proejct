const mongoose = require("mongoose");

const screenTimeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    category: {
      type: String,
      default: "Other"
    },
    hours: {
      type: Number,
      required: true,
      default: 0
    },
    notes: {
      type: String,
      default: ""
    },
    source: {
      type: String,
      default: "manual"
    },
    domain: {
      type: String,
      default: ""
    },
    title: {
      type: String,
      default: ""
    },
    url: {
      type: String,
      default: ""
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ScreenTime", screenTimeSchema);