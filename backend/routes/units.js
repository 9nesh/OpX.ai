const express = require('express');
const router = express.Router();
const Unit = require('../models/Unit');
const Incident = require('../models/Incident');
const mongoose = require('mongoose');

// Reference to io needs to be set from server.js
let io;
router.setIo = function(socketIo) {
  io = socketIo;
};

// Get all units
router.get('/', async (req, res) => {
  try {
    const units = await Unit.find().populate('currentIncident');
    res.json(units);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get unit by ID
router.get('/:id', async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id).populate('currentIncident');
    if (!unit) return res.status(404).json({ message: 'Unit not found' });
    res.json(unit);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new unit
router.post('/', async (req, res) => {
  const unit = new Unit({
    callSign: req.body.callSign,
    type: req.body.type,
    capabilities: req.body.capabilities,
    location: req.body.location
  });

  try {
    const newUnit = await unit.save();
    
    // Emit WebSocket event for new unit
    if (io) {
      io.emit('unit_created', newUnit);
    }
    
    res.status(201).json(newUnit);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update unit status
router.patch('/:id/status', async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ message: 'Unit not found' });
    
    const oldStatus = unit.status;
    unit.status = req.body.status;
    unit.lastUpdated = Date.now();
    
    const updatedUnit = await unit.save();
    
    // Emit WebSocket event for status change
    if (io && oldStatus !== updatedUnit.status) {
      io.emit('unit_status_changed', {
        unitId: updatedUnit._id,
        callSign: updatedUnit.callSign,
        oldStatus,
        newStatus: updatedUnit.status
      });
    }
    
    res.json(updatedUnit);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update unit location
router.patch('/:id/location', async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ message: 'Unit not found' });
    
    const oldCoordinates = [...unit.location.coordinates];
    unit.location.coordinates = req.body.coordinates;
    unit.lastUpdated = Date.now();
    
    const updatedUnit = await unit.save();
    
    // Emit WebSocket event for location change
    if (io) {
      io.emit('unit_location_changed', {
        unitId: updatedUnit._id.toString(),
        callSign: updatedUnit.callSign,
        coordinates: updatedUnit.location.coordinates,
        oldCoordinates,
        timestamp: updatedUnit.lastUpdated
      });
    }
    
    res.json(updatedUnit);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Find nearest available units
router.get('/available/nearest', async (req, res) => {
  const { longitude, latitude, maxDistance = 20000, limit = 5 } = req.query;
  
  try {
    const units = await Unit.find({
      status: 'AVAILABLE',
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance) // in meters
        }
      }
    }).limit(parseInt(limit));
    
    res.json(units);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Assign a unit to an incident
router.post('/:id/assign', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const unit = await Unit.findById(req.params.id).session(session);
    if (!unit) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Unit not found' });
    }
    
    const incident = await Incident.findById(req.body.incidentId).session(session);
    if (!incident) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Incident not found' });
    }
    
    // Check if unit is available
    if (unit.status !== 'AVAILABLE') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: `Unit is not available, current status: ${unit.status}` });
    }
    
    // Update unit status and assign incident
    const oldStatus = unit.status;
    unit.status = 'EN_ROUTE';
    unit.currentIncident = incident._id;
    unit.lastUpdated = Date.now();
    await unit.save({ session });
    
    // Add unit to incident if not already there
    if (!incident.dispatchedUnits.includes(unit._id)) {
      const oldIncidentStatus = incident.status;
      incident.dispatchedUnits.push(unit._id);
      
      if (incident.status === 'PENDING') {
        incident.status = 'DISPATCHED';
      }
      
      incident.updatedAt = Date.now();
      await incident.save({ session });
      
      // Emit incident status change if changed
      if (io && oldIncidentStatus !== incident.status) {
        io.emit('incident_status_changed', {
          incidentId: incident._id,
          oldStatus: oldIncidentStatus,
          newStatus: incident.status
        });
      }
    }
    
    await session.commitTransaction();
    session.endSession();
    
    // Emit unit dispatched event
    if (io) {
      io.emit('unit_dispatched', {
        unitId: unit._id.toString(),
        incidentId: incident._id.toString(),
        unitCallSign: unit.callSign,
        oldStatus,
        newStatus: 'EN_ROUTE'
      });
    }
    
    // Populate and return the full updated objects
    const updatedUnit = await Unit.findById(unit._id).populate('currentIncident');
    const updatedIncident = await Incident.findById(incident._id).populate('dispatchedUnits');
    
    res.json({
      unit: updatedUnit,
      incident: updatedIncident
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ message: err.message });
  }
});

// Set unit status to EN_ROUTE
router.post('/:id/en-route', async (req, res) => {
  try {
    const unitId = req.params.id;
    
    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find the unit and update its status
      const unit = await Unit.findById(unitId).session(session);
      
      if (!unit) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Unit not found' });
      }
      
      if (!unit.currentIncident) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Unit is not assigned to any incident' });
      }
      
      // Update the unit status
      const updatedUnit = await Unit.findByIdAndUpdate(
        unitId,
        { status: 'EN_ROUTE' },
        { new: true }
      ).session(session);
      
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
      
      // Emit socket event
      if (io) {
        io.emit('unit_status_changed', {
          unitId: updatedUnit._id,
          newStatus: 'EN_ROUTE'
        });
      }
      
      res.json(updatedUnit);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Transaction error:', error);
      res.status(500).json({ message: 'Server error during transaction' });
    }
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 