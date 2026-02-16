const mongoose = require('mongoose');

const partySchema = new mongoose.Schema({
  partyId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  leaderId: {
    type: String,
    required: true,
    ref: 'User'
  },
  members: [{
    type: String,
    ref: 'User'
  }],
  invites: [{
    type: String,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // 24時間後に自動削除
  }
});

module.exports = mongoose.model('Party', partySchema);
