# RapidResponse AI-CAD System

RapidResponse is an AI-powered Computer-Aided Dispatch system for emergency services. It helps dispatchers efficiently manage incidents and emergency units using geospatial data and artificial intelligence.

## Features

- Real-time tracking of emergency units and incidents
- AI-powered unit dispatch recommendations
- Real-time updates via WebSockets
- Interactive map view of all units and incidents
- Incident filtering and management
- Unit status tracking and updates

## System Architecture

The system consists of four main components:

1. **Frontend**: React application with map visualization
2. **Backend API**: Express.js server managing incidents and units
3. **AI Service**: Python FastAPI service for dispatch recommendations
4. **Database**: MongoDB for data storage

## Running Locally

### Prerequisites

- Node.js (v14+)
- MongoDB
- Python 3.9+

### Backend Setup

```bash
cd backend
npm install
# Create a .env file with:
# PORT=5001
# MONGODB_URI=mongodb://localhost:27017/rapidresponse
# AI_SERVICE_URL=http://localhost:8000/predict
# BASE_URL=http://localhost:5001
npm start
```

### AI Service Setup

```bash
cd ai-model
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

### Seed Sample Data

```bash
cd backend
node scripts/seed.js
```

## Running with Docker

You can run the entire system with Docker Compose:

```bash
docker-compose build
docker-compose up
```

This will start:
- Frontend on http://localhost:3000
- Backend on http://localhost:5001
- AI Service on http://localhost:8000
- MongoDB on port 27017

## License

MIT 