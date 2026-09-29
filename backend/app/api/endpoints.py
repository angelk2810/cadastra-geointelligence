import os
import shutil
import json
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.ml.inference import inference_service
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.validation import make_valid

router = APIRouter()

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/uploads"))
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/outputs"))

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

class ExtractRequest(BaseModel):
    filename: str

class ValidateGeometryRequest(BaseModel):
    geometry: dict

@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    saved_filename = f"{file_id}{ext}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"filename": saved_filename, "original_name": file.filename, "status": "READY"}

@router.get("/image/{filename}")
async def get_image(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path)

@router.post("/extract")
async def run_extraction(req: ExtractRequest):
    file_path = os.path.join(UPLOAD_DIR, req.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        result_data = inference_service.extract_buildings(file_path, req.filename)
        
        output_filename = f"out_{req.filename}.geojson"
        output_path = os.path.join(OUTPUT_DIR, output_filename)
        
        geojson_export = {
            "type": "FeatureCollection",
            "features": result_data.get("features", [])
        }
        
        with open(output_path, "w") as f:
            json.dump(geojson_export, f)
            
        return result_data
    except RuntimeError as e:
        if "could not be loaded" in str(e) or "not currently loaded" in str(e):
            return JSONResponse(
                status_code=503,
                content={
                    "status": "MODEL_UNAVAILABLE",
                    "message": str(e)
                }
            )
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validate_geometry")
async def validate_geometry(req: ValidateGeometryRequest):
    try:
        geom = shape(req.geometry)
        is_valid = geom.is_valid
        area = geom.area
        
        if not is_valid:
            geom = make_valid(geom)
            is_valid = geom.is_valid
            
        is_polygon = isinstance(geom, (Polygon, MultiPolygon))
        is_good = is_valid and is_polygon and area > 0
        
        return {
            "valid": is_good,
            "area": area,
            "geometry": geom.__geo_interface__ if is_good else None,
            "message": "VALID GEOMETRY" if is_good else "INVALID GEOMETRY"
        }
    except Exception as e:
        return {"valid": False, "message": str(e), "geometry": None}

@router.get("/metrics")
async def get_metrics():
    return {
        "available": False,
        "reason": "Ground-truth data is not available for this project."
    }

from app.ml.evaluation import evaluate_predictions

class EvaluateRequest(BaseModel):
    predictions: dict
    ground_truth: dict
    iou_threshold: float = 0.5

class ExportRequest(BaseModel):
    features: list
    filename: str
    crs: Optional[str] = None
    georeferenced: bool = False

@router.post("/evaluate")
async def evaluate_data(req: EvaluateRequest):
    try:
        return evaluate_predictions(req.predictions, req.ground_truth, req.iou_threshold)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export_features")
async def export_features(req: ExportRequest):
    valid_features = []
    for f in req.features:
        status = f.get("properties", {}).get("review_status", "PENDING")
        if status == "REJECTED":
            continue
            
        try:
            geom = shape(f["geometry"])
            if geom.is_empty or not geom.is_valid:
                continue
            valid_features.append(f)
        except:
            continue
        
    if not valid_features:
        raise HTTPException(status_code=400, detail="No exportable features available.")
        
    geojson_out = {
        "type": "FeatureCollection",
        "features": valid_features
    }
    
    if req.georeferenced and req.crs:
        geojson_out["crs"] = {
            "type": "name",
            "properties": {"name": req.crs}
        }
        
    output_filename = f"reviewed_{req.filename}.geojson"
    output_path = os.path.join(OUTPUT_DIR, output_filename)
    
    with open(output_path, "w") as f:
        json.dump(geojson_out, f)
        
    return {"download_url": f"/api/download/{output_filename}"}

@router.get("/download/{filename}")
async def download_file(filename: str):
    output_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(output_path, media_type="application/geo+json", filename=filename)
