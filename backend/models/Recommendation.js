const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  incident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    required: true
  },
  recommendations: [{
    unit_id: String,
    call_sign: String,
    type: String,
    distance: Number,
    score: Number
  }],
  status: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
    default: 'PENDING'
  },
  acceptedUnitId: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Recommendation = mongoose.model('Recommendation', recommendationSchema);

module.exports = Recommendation; 