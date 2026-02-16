const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  nickname: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  fingerprint: {
    type: String,
    required: true,
    unique: true
  },
  icon: {
    type: String,
    default: '🔵'
  },
  friends: [{
    type: String, // UID of friend
    ref: 'User'
  }],
  friendRequestsSent: [{
    type: String, // UID of user to whom request was sent
    ref: 'User'
  }],
  friendRequestsReceived: [{
    type: String, // UID of user from whom request was received
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// インデックス
userSchema.index({ nickname: 1 });
userSchema.index({ fingerprint: 1 });

module.exports = mongoose.model('User', userSchema);
