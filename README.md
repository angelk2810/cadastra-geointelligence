# CadastraAI

AI-assisted urban cadastral feature extraction from aerial/drone imagery.

## Overview
This is a clean, minimal, professional, GIS-focused MVP application. 
It supports:
1. Uploading aerial/drone images
2. Simulating AI building-footprint extraction
3. Inspecting and validating geometries via OpenLayers
4. Exporting GeoJSON
5. Displaying accuracy metrics (when ground truth is available)

## Requirements
- Python 3.9+
- Node.js 18+

## Setup & Running

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or venv\Scripts\activate on Windows
pip install -r requirements.txt
pip install httpx pytest # for testing
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Testing

### Backend
```bash
cd backend
pytest tests/
```

### Frontend (Typescript validation)
```bash
cd frontend
npm run build
```
