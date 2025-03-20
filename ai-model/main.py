from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import uvicorn
import requests
import math
import os
from datetime import datetime
import json
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up MongoDB connection
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/rapidresponse")
client = MongoClient(MONGODB_URI)
db = client.get_database()

app = FastAPI(title="RapidResponse AI Dispatch Service")

# Custom JSONEncoder to handle ObjectId for storing recommendations
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

# Dispatch model for resource allocation
class DispatchModel:
    def __init__(self):
        # These would be parameters from a trained model
        self.priority_weights = {
            1: 0.25,  # Low priority
            2: 0.5,
            3: 0.75,
            4: 0.9,
            5: 1.0    # Highest priority
        }
        
        # Type compatibility matrix - which unit types can handle which incident types
        self.type_compatibility = {
            "MEDICAL": ["AMBULANCE"],
            "FIRE": ["FIRE_ENGINE"],
            "POLICE": ["POLICE_CAR"],
            "OTHER": ["AMBULANCE", "FIRE_ENGINE", "POLICE_CAR", "OTHER"]
        }
    
    def score_unit(self, unit, incident_location, incident_type, priority):
        """Score a unit's suitability for an incident."""
        # Calculate distance (simplified - using Euclidean distance)
        unit_loc = unit["location"]["coordinates"]
        incident_loc = incident_location
        
        # Calculate distance in km (approximate)
        dx = 111.32 * (unit_loc[1] - incident_loc[1]) # latitude difference in km
        dy = 111.32 * math.cos(incident_loc[0] * math.pi / 180) * (unit_loc[0] - incident_loc[0]) # longitude difference in km
        distance = math.sqrt(dx**2 + dy**2)
        
        # Distance score (inverse - closer is better)
        distance_score = 1 / (1 + distance)
        
        # Type compatibility score
        type_score = 1.0 if unit["type"] in self.type_compatibility.get(incident_type, []) else 0.0
        
        # Priority weight
        priority_weight = self.priority_weights.get(priority, 0.5)
        
        # Final score combines distance, type compatibility, and priority
        final_score = distance_score * type_score * priority_weight
        
        return {
            "unit_id": str(unit["_id"]),
            "call_sign": unit["callSign"],
            "type": unit["type"],
            "distance": distance,
            "score": final_score
        }

# Request model
class DispatchRequest(BaseModel):
    incidentType: str
    priority: int
    location: List[float]  # [longitude, latitude]
    currentlyAssignedUnits: Optional[List[str]] = []
    incidentId: Optional[str] = None

# Response model for unit recommendations
class UnitRecommendation(BaseModel):
    unit_id: str
    call_sign: str
    type: str
    distance: float
    score: float

# Create model instance
dispatch_model = DispatchModel()

# Get available units from MongoDB
def get_available_units():
    try:
        # Query MongoDB for all available units
        units = list(db.units.find({"status": "AVAILABLE"}))
        
        # Convert ObjectId to string for serialization
        for unit in units:
            unit["_id"] = str(unit["_id"])
            
        return units
    except Exception as e:
        print(f"Error getting units from database: {e}")
        return []

# Store recommendations in the database
def store_recommendations(incident_id, recommendations):
    try:
        # Create a recommendation document
        recommendation_doc = {
            "incidentId": ObjectId(incident_id),
            "recommendations": recommendations,
            "timestamp": datetime.now(),
            "status": "PENDING"  # PENDING, ACCEPTED, REJECTED
        }
        
        # Insert into MongoDB
        result = db.recommendations.insert_one(recommendation_doc)
        return str(result.inserted_id)
    except Exception as e:
        print(f"Error storing recommendations: {e}")
        return None

@app.get("/")
def read_root():
    return {"message": "RapidResponse AI Dispatch Service"}

@app.post("/predict", response_model=List[UnitRecommendation])
def predict_dispatch(request: DispatchRequest, background_tasks: BackgroundTasks):
    """Recommend units for dispatch based on incident details."""
    try:
        # Query the database for available units
        units = get_available_units()
        
        # Filter out units that are already assigned to this incident
        available_units = [u for u in units if u["_id"] not in request.currentlyAssignedUnits]
        
        # Score each unit for this incident
        scored_units = []
        for unit in available_units:
            score = dispatch_model.score_unit(
                unit, 
                request.location, 
                request.incidentType, 
                request.priority
            )
            scored_units.append(score)
        
        # Sort by score (descending)
        scored_units.sort(key=lambda x: x["score"], reverse=True)
        
        # Get top 3 recommendations (or fewer if not enough available)
        top_recommendations = scored_units[:3]
        
        # Store recommendations in database if incident ID provided
        if request.incidentId:
            background_tasks.add_task(store_recommendations, request.incidentId, top_recommendations)
        
        return top_recommendations
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True) 