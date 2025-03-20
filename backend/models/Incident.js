const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['MEDICAL', 'FIRE', 'POLICE', 'OTHER']
  },
  priority: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  location: {
    type: {
      type: String,
      default: 'Point',
      enum: ['Point']
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    address: {
      type: String,
      required: true
    }
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'RESOLVED'],
    default: 'PENDING'
  },
  dispatchedUnits: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create a 2dsphere index for location-based queries
incidentSchema.index({ 'location.coordinates': '2dsphere' });

const Incident = mongoose.model('Incident', incidentSchema);

module.exports = Incident; 