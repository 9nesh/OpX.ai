const mongoose = require('mongoose');
const Incident = require('../models/Incident');
const Unit = require('../models/Unit');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

const seedDatabase = async () => {
  try {
    // Clear existing data
    await Incident.deleteMany({});
    await Unit.deleteMany({});
    
    console.log("Existing data cleared");
    
    // Create sample units
    const units = await Unit.insertMany([
      { 
        callSign: "A101", 
        type: "AMBULANCE", 
        status: "AVAILABLE", 
        capabilities: ["ALS", "BLS"],
        location: { 
          type: "Point", 
          coordinates: [-122.4194, 37.7749] 
        } 
      },
      { 
        callSign: "F202", 
        type: "FIRE_ENGINE", 
        status: "AVAILABLE", 
        capabilities: ["HAZMAT", "RESCUE"],
        location: { 
          type: "Point", 
          coordinates: [-122.431297, 37.773972] 
        } 
      },
      { 
        callSign: "P303", 
        type: "POLICE_CAR", 
        status: "AVAILABLE", 
        capabilities: ["K9"],
        location: { 
          type: "Point", 
          coordinates: [-122.446747, 37.765136] 
        } 
      },
      { 
        callSign: "A102", 
        type: "AMBULANCE", 
        status: "AVAILABLE", 
        capabilities: ["ALS"],
        location: { 
          type: "Point", 
          coordinates: [-122.410679, 37.782537] 
        } 
      },
      { 
        callSign: "F203", 
        type: "FIRE_ENGINE", 
        status: "AVAILABLE", 
        capabilities: ["RESCUE"],
        location: { 
          type: "Point", 
          coordinates: [-122.425097, 37.774853] 
        } 
      },
    ]);

    console.log(`Created ${units.length} units`);

    // Create sample incidents
    const incidents = await Incident.insertMany([
      { 
        type: "MEDICAL", 
        priority: 5, 
        location: { 
          type: "Point", 
          coordinates: [-122.420679, 37.772537], 
          address: "500 Market St, San Francisco, CA" 
        }, 
        description: "Heart attack emergency", 
        status: "PENDING", 
        dispatchedUnits: [] 
      },
      { 
        type: "FIRE", 
        priority: 4, 
        location: { 
          type: "Point", 
          coordinates: [-122.435097, 37.764853], 
          address: "123 Main St, San Francisco, CA" 
        }, 
        description: "Building fire reported", 
        status: "PENDING", 
        dispatchedUnits: [] 
      },
      { 
        type: "POLICE", 
        priority: 3, 
        location: { 
          type: "Point", 
          coordinates: [-122.447478, 37.758788], 
          address: "456 Elm St, San Francisco, CA" 
        }, 
        description: "Armed robbery in progress", 
        status: "PENDING", 
        dispatchedUnits: [] 
      },
      { 
        type: "MEDICAL", 
        priority: 2, 
        location: { 
          type: "Point", 
          coordinates: [-122.405097, 37.784853], 
          address: "789 Oak St, San Francisco, CA" 
        }, 
        description: "Fall victim with possible fracture", 
        status: "PENDING", 
        dispatchedUnits: [] 
      },
      { 
        type: "FIRE", 
        priority: 4, 
        location: { 
          type: "Point", 
          coordinates: [-122.415097, 37.774853], 
          address: "321 Pine St, San Francisco, CA" 
        }, 
        description: "Gas leak reported", 
        status: "PENDING", 
        dispatchedUnits: [] 
      },
    ]);

    console.log(`Created ${incidents.length} incidents`);
    console.log("Database seeded successfully!");
    mongoose.connection.close();
  } catch (error) {
    console.error("Seeding error:", error);
    mongoose.connection.close();
  }
};

seedDatabase(); 