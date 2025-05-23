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
  postalCode: {
    type: String,
    trim: true
  },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  lastLocationUpdate: {
    type: Date,
    default: Date.now
  },
  locationSharingEnabled: {
    type: Boolean,
    default: true
  },
  remoteWorkEnabled: {
    type: Boolean,
    default: false
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

// Create a 2dsphere index for geospatial queries
ProfessionalInfoSchema.index({ coordinates: '2dsphere' });

module.exports = mongoose.model('ProfessionalInfo', ProfessionalInfoSchema);
