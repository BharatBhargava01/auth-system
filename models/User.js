const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: function() {
      return this.provider !== 'phone';
    },
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  password: {
    type: String,
    required: function() {
      return this.provider === 'local';
    }
  },
  name: {
    type: String,
    trim: true
  },
  avatar: {
    type: String
  },
  provider: {
    type: String,
    enum: ['local', 'google', 'github', 'facebook', 'phone'],
    default: 'local'
  },
  providerId: {
    type: String
  },
  security: {
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lastFailedLoginAt: {
      type: Date,
      default: null
    },
    lockUntil: {
      type: Date,
      default: null
    },
    lastLoginIp: {
      type: String,
      default: null
    },
    lastLoginUserAgent: {
      type: String,
      default: null
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);
