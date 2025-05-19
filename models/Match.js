const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
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
  action: {
    type: String,
    enum: ['like', 'dislike'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure a user can only have one match action per other user
// If a user changes their mind, the existing record will be updated
MatchSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

module.exports = mongoose.model('Match', MatchSchema);
