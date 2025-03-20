const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios');

// Routes
const incidentRoutes = require('./routes/incidents');
const unitRoutes = require('./routes/units');
const recommendationRoutes = require('./routes/recommendations');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

// Pass io reference to routes
incidentRoutes.setIo(io);
unitRoutes.setIo(io);
recommendationRoutes.setIo(io);

// API Routes
app.use('/api/incidents', incidentRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/recommendations', recommendationRoutes);

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('unit_location_update', (data) => {
    // Forward this to the unit location update API
    if (data && data.unitId && data.coordinates) {
      try {
        axios.patch(`${process.env.BASE_URL}/api/units/${data.unitId}/location`, {
          coordinates: data.coordinates
        });
      } catch (err) {
        console.error('Error updating unit location:', err);
      }
    }
  });
  
  socket.on('new_incident', (data) => {
    // Forward to the create incident API
    if (data) {
      try {
        axios.post(`${process.env.BASE_URL}/api/incidents`, data);
      } catch (err) {
        console.error('Error creating incident:', err);
      }
    }
  });
  
  socket.on('dispatch_unit', async (data) => {
    // Forward to the unit assign API
    if (data && data.unitId && data.incidentId) {
      try {
        axios.post(`${process.env.BASE_URL}/api/units/${data.unitId}/assign`, {
          incidentId: data.incidentId
        });
      } catch (err) {
        console.error('Error dispatching unit:', err);
      }
    }
  });
  
  socket.on('unit_en_route', async (data) => {
    // Forward to the en-route API
    if (data && data.unitId) {
      try {
        axios.post(`${process.env.BASE_URL}/api/units/${data.unitId}/en-route`);
      } catch (err) {
        console.error('Error setting unit to en-route:', err);
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 