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
  }
});

module.exports = mongoose.model('ProfessionalInfo', ProfessionalInfoSchema);
