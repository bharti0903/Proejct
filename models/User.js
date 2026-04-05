const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    },

    warningThreshold: {
      type: Number,
      default: 2
    },
    alertThreshold: {
      type: Number,
      default: 4
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);