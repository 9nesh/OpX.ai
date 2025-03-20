const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  callSign: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    required: true,
    enum: ['AMBULANCE', 'FIRE_ENGINE', 'POLICE_CAR', 'OTHER']
  },
  capabilities: [{
    type: String,
    enum: ['ALS', 'BLS', 'HAZMAT', 'RESCUE', 'K9', 'TACTICAL']
  }],
  status: {
    type: String,
    enum: ['AVAILABLE', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'RETURNING', 'OUT_OF_SERVICE'],
    default: 'AVAILABLE'
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
    }
  },
  currentIncident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    default: null
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Create a 2dsphere index for location-based queries
unitSchema.index({ 'location.coordinates': '2dsphere' });

const Unit = mongoose.model('Unit', unitSchema);

module.exports = Unit; 