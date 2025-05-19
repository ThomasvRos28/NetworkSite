const mongoose = require('mongoose');

const ProfessionalInfoSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  workExperience: {
    type: Number,
    default: 0
  },
  companyName: {
    type: String,
    trim: true
  },
  fieldOfWork: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  availableForMentorship: {
    type: Boolean,
    default: false
  },
  mentorshipDetails: {
    type: String,
    trim: true,
    default: ''
  }
});

module.exports = mongoose.model('ProfessionalInfo', ProfessionalInfoSchema);
