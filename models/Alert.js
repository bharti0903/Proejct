const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    message: {
      type: String,
      required: true,
      trim: true
    },

    type: {
      type: String,
      enum: ["warning", "danger", "info"],
      default: "info"
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true
    },

    // 🔥 ADD THIS (important for tracking read time)
    readAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Alert || mongoose.model("Alert", alertSchema);