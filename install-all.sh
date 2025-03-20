#!/bin/bash
echo "Installing backend dependencies..."
cd backend && npm install

echo "Installing frontend dependencies..."
cd ../frontend && npm install

echo "Installing AI model dependencies..."
cd ../ai-model

# Check for Python version and create a compatible venv
if command -v python3.10 &> /dev/null; then
  # Use Python 3.10 if available
  python3.10 -m venv venv
elif command -v python3.9 &> /dev/null; then
  # Use Python 3.9 if 3.10 isn't available
  python3.9 -m venv venv
else
  # Fall back to system Python
  python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

echo "All dependencies installed successfully!"
echo ""
echo "To start the application:"
echo "1. Start MongoDB: brew services start mongodb-community"
echo "2. Start backend: cd backend && npm run dev"
echo "3. Start AI model: cd ai-model && source venv/bin/activate && python main.py"
echo "4. Start frontend: cd frontend && npm start" 