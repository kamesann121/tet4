const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  uid: {
    type: String,
    required: true,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000 // 30日後に自動削除
  }
});

module.exports = mongoose.model('Session', sessionSchema);
