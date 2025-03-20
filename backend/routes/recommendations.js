const express = require('express');
const router = express.Router();
const Recommendation = require('../models/Recommendation');
const Incident = require('../models/Incident');
const Unit = require('../models/Unit');
const mongoose = require('mongoose');

// Reference to io needs to be set from server.js
let io;
router.setIo = function(socketIo) {
  io = socketIo;
};

// Get all recommendations
router.get('/', async (req, res) => {
  try {
    const recommendations = await Recommendation.find().sort({ createdAt: -1 });
    res.json(recommendations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a specific recommendation
router.get('/:id', async (req, res) => {
  try {
    const recommendation = await Recommendation.findById(req.params.id);
    if (!recommendation) return res.status(404).json({ message: 'Recommendation not found' });
    res.json(recommendation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Accept a recommendation
router.post('/:id/accept', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const recommendation = await Recommendation.findById(req.params.id).session(session);
    if (!recommendation) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Recommendation not found' });
    }
    
    const unitId = req.body.unitId;
    const unit = await Unit.findById(unitId).session(session);
    if (!unit) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Unit not found' });
    }
    
    // Check if unit is available
    if (unit.status !== 'AVAILABLE') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Unit is not available for dispatch' });
    }
    
    const incidentId = recommendation.incident;
    const incident = await Incident.findById(incidentId).session(session);
    if (!incident) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Incident not found' });
    }
    
    // Update recommendation status
    recommendation.status = 'ACCEPTED';
    recommendation.acceptedUnitId = unitId;
    await recommendation.save({ session });
    
    // Add the unit to the incident
    incident.dispatchedUnits.push(unitId);
    if (incident.status === 'PENDING') {
      incident.status = 'DISPATCHED';
    }
    incident.updatedAt = Date.now();
    await incident.save({ session });
    
    // Update the unit's status and current incident
    unit.status = 'DISPATCHED';
    unit.currentIncident = incident._id;
    await unit.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    // Emit WebSocket event for dispatch
    if (io) {
      io.emit('unit_dispatched', {
        unitId,
        incidentId: incident._id,
        unitCallSign: unit.callSign,
        incidentType: incident.type,
        incidentLocation: incident.location,
        recommendationId: recommendation._id
      });
    }
    
    res.json(incident);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
});

// Reject a recommendation
router.post('/:id/reject', async (req, res) => {
  try {
    const recommendation = await Recommendation.findById(req.params.id);
    if (!recommendation) return res.status(404).json({ message: 'Recommendation not found' });
    
    recommendation.status = 'REJECTED';
    await recommendation.save();
    
    res.json(recommendation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 