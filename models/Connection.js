const mongoose = require('mongoose');

const ConnectionSchema = new mongoose.Schema({
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure a user can only send one connection request to another user
ConnectionSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

module.exports = mongoose.model('Connection', ConnectionSchema);
