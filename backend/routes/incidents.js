const express = require('express');
const router = express.Router();
const Incident = require('../models/Incident');
const Unit = require('../models/Unit');
const Recommendation = require('../models/Recommendation');
const axios = require('axios');
const mongoose = require('mongoose');

// Reference to io needs to be set from server.js
let io;
router.setIo = function(socketIo) {
  io = socketIo;
};

// Get all incidents
router.get('/', async (req, res) => {
  try {
    const incidents = await Incident.find().populate('dispatchedUnits');
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get incident by ID
router.get('/:id', async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id).populate('dispatchedUnits');
    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    res.json(incident);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new incident
router.post('/', async (req, res) => {
  const incident = new Incident({
    type: req.body.type,
    priority: req.body.priority,
    location: req.body.location,
    description: req.body.description
  });

  try {
    const newIncident = await incident.save();
    
    // Emit WebSocket event for new incident
    if (io) {
      io.emit('incident_created', newIncident);
    }
    
    res.status(201).json(newIncident);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update incident status
router.patch('/:id/status', async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    
    const oldStatus = incident.status;
    incident.status = req.body.status;
    incident.updatedAt = Date.now();
    
    const updatedIncident = await incident.save();
    
    // Emit WebSocket event for status change
    if (io && oldStatus !== updatedIncident.status) {
      io.emit('incident_status_changed', {
        incidentId: updatedIncident._id,
        oldStatus,
        newStatus: updatedIncident.status
      });
    }
    
    res.json(updatedIncident);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Request AI-based unit dispatch recommendation
router.post('/:id/recommend-units', async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    
    // Call the AI service to get recommended units
    const response = await axios.post(process.env.AI_SERVICE_URL, {
      incidentType: incident.type,
      priority: incident.priority,
      location: incident.location.coordinates,
      currentlyAssignedUnits: incident.dispatchedUnits.map(u => u.toString()),
      incidentId: incident._id.toString()
    });
    
    // Store the recommendations in our database
    const recommendation = new Recommendation({
      incident: incident._id,
      recommendations: response.data,
      status: 'PENDING'
    });
    
    await recommendation.save();
    
    // Emit WebSocket event for new recommendations
    if (io) {
      io.emit('new_recommendations', {
        incidentId: incident._id,
        recommendations: response.data
      });
    }
    
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all recommendations for an incident
router.get('/:id/recommendations', async (req, res) => {
  try {
    const recommendations = await Recommendation.find({ 
      incident: req.params.id 
    }).sort({ createdAt: -1 });
    
    res.json(recommendations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Dispatch a unit to an incident
router.post('/:id/dispatch', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const incident = await Incident.findById(req.params.id).session(session);
    if (!incident) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Incident not found' });
    }
    
    const unitId = req.body.unitId;
    const unit = await Unit.findById(unitId).session(session);
    if (!unit) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Unit not found' });
    }
    
    // Check if the unit is already assigned to this incident
    if (incident.dispatchedUnits.includes(unitId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Unit already assigned to this incident' });
    }
    
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
    
    // Update recommendation status if exists
    if (req.body.recommendationId) {
      await Recommendation.findByIdAndUpdate(
        req.body.recommendationId,
        { 
          status: 'ACCEPTED',
          acceptedUnitId: unitId
        },
        { session }
      );
    }
    
    await session.commitTransaction();
    session.endSession();
    
    // Emit WebSocket event for dispatch
    if (io) {
      io.emit('unit_dispatched', {
        unitId,
        incidentId: incident._id,
        unitCallSign: unit.callSign,
        incidentType: incident.type,
        incidentLocation: incident.location
      });
    }
    
    res.json({
      incident: await Incident.findById(incident._id).populate('dispatchedUnits'),
      unit: await Unit.findById(unit._id)
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ message: err.message });
  }
});

module.exports = router; 