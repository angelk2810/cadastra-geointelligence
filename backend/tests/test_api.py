import pytest
import os
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.ml.inference import inference_service

client = TestClient(app)

def test_no_hardcoded_geometries_in_inference():
    with open("app/ml/inference.py", "r") as f:
        content = f.read()
        assert "confidence" not in content
        assert "Polygon(" not in content
        assert "[[[" not in content

def test_extract_model_unavailable():
    os.makedirs("../data/uploads", exist_ok=True)
    with open("../data/uploads/dummy.tif", "w") as f:
        f.write("dummy")

    original_id = inference_service.model_id
    inference_service.model_id = "invalid/path/that/does/not/exist"
    inference_service.is_loaded = False

    response = client.post("/api/extract", json={"filename": "dummy.tif"})
    
    inference_service.model_id = original_id
    
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "MODEL_UNAVAILABLE"
    assert "could not be loaded" in data["message"]
    
    os.remove("../data/uploads/dummy.tif")

@patch('app.ml.inference.BuildingSegmentationInference.extract_buildings')
def test_successful_inference_structure(mock_extract):
    mock_extract.return_value = {
        "status": "SUCCESS",
        "source": {"filename": "test.tif", "georeferenced": False, "crs": None},
        "model": {"id": "test", "architecture": "SegFormer", "device": "cpu"},
        "metrics": {"buildings_detected": 0, "valid_polygons": 0, "inference_time_seconds": 1.0, "total_processing_time_seconds": 1.2},
        "features": []
    }
    
    os.makedirs("../data/uploads", exist_ok=True)
    with open("../data/uploads/test.tif", "w") as f:
        f.write("dummy")

    response = client.post("/api/extract", json={"filename": "test.tif"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert "metrics" in data
    assert data["metrics"]["valid_polygons"] == 0
    
    os.remove("../data/uploads/test.tif")

def test_metrics_no_gt():
    response = client.get("/api/metrics")
    assert response.status_code == 200
    data = response.json()
    assert data["available"] is False
    assert "Ground-truth data is not available" in data["reason"]

def test_export_not_found():
    response = client.get("/api/download/nonexistent_file")
    assert response.status_code == 404
    assert "File not found" in response.json()["detail"]

def test_validate_geometry():
    # Valid geometry
    valid_poly = {
        "type": "Polygon",
        "coordinates": [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
    }
    response = client.post("/api/validate_geometry", json={"geometry": valid_poly})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["message"] == "VALID GEOMETRY"
    
    # Degenerate/invalid geometry (e.g. crossing lines that can be repaired or degenerate point)
    degenerate_poly = {
        "type": "Polygon",
        "coordinates": [[[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]]
    }
    response2 = client.post("/api/validate_geometry", json={"geometry": degenerate_poly})
    assert response2.status_code == 200
    assert response2.json()["valid"] is False

def test_export_features_success():
    features = [
        {
            "type": "Feature",
            "properties": {"review_status": "ACCEPTED"},
            "geometry": {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        },
        {
            "type": "Feature",
            "properties": {"review_status": "REJECTED"},
            "geometry": {"type": "Polygon", "coordinates": [[[2,2], [2,3], [3,3], [3,2], [2,2]]]}
        }
    ]
    response = client.post("/api/export_features", json={"features": features, "filename": "test"})
    assert response.status_code == 200
    data = response.json()
    assert "download_url" in data
    
def test_export_features_empty():
    features = [
        {
            "type": "Feature",
            "properties": {"review_status": "REJECTED"},
            "geometry": {"type": "Polygon", "coordinates": [[[2,2], [2,3], [3,3], [3,2], [2,2]]]}
        }
    ]
    response = client.post("/api/export_features", json={"features": features, "filename": "test"})
    assert response.status_code == 400
    assert "No exportable features available" in response.json()["detail"]

def test_evaluate_endpoint():
    preds = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [[[0,0], [0,2], [2,2], [2,0], [0,0]]]}
            }
        ]
    }
    gt = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [[[1,1], [1,3], [3,3], [3,1], [1,1]]]}
            }
        ]
    }
    
    response = client.post("/api/evaluate", json={"predictions": preds, "ground_truth": gt, "iou_threshold": 0.05})
    assert response.status_code == 200
    data = response.json()
    assert data["available"] is True
    assert data["metrics"]["iou"] > 0
    assert data["metrics"]["precision"] == 1.0
