import os
import time
import torch
import numpy as np
import rasterio
from rasterio.features import shapes
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.validation import make_valid
import cv2
from transformers import SegformerImageProcessor, SegformerForSemanticSegmentation
from PIL import Image

class BuildingSegmentationInference:
    def __init__(self):
        self.model_id = os.getenv("MODEL_ID", "tomascanivari/segformer-b0-finetuned-buildings")
        self.device = os.getenv("MODEL_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
        self.target_class_idx = int(os.getenv("TARGET_CLASS_IDX", "1")) # ADE20K: 1 is building
        self.processor = None
        self.model = None
        self.is_loaded = False

    def load_model(self):
        """Loads the model and processor from HuggingFace."""
        if self.is_loaded:
            return

        try:
            self.processor = SegformerImageProcessor.from_pretrained(self.model_id)
            self.model = SegformerForSemanticSegmentation.from_pretrained(self.model_id)
            self.model.to(self.device)
            self.model.eval()
            self.is_loaded = True
        except Exception as e:
            self.is_loaded = False
            raise RuntimeError(f"Real AI model could not be loaded. Reason: {str(e)}")

    def preprocess_image(self, image_path: str):
        """Loads image and metadata, prepares for model."""
        with rasterio.open(image_path) as src:
            image_data = src.read()
            # Handle channels
            if image_data.shape[0] >= 3:
                image_data = image_data[:3, :, :]
            elif image_data.shape[0] == 1:
                image_data = np.repeat(image_data, 3, axis=0)
            
            # Convert to HWC for PIL
            image_data = np.moveaxis(image_data, 0, -1)
            
            crs = src.crs.to_string() if src.crs else None
            transform = src.transform
            width = src.width
            height = src.height
            bounds = [src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top]
            georeferenced = bool(src.crs and src.transform != rasterio.transform.Affine.identity())
            
        pil_image = Image.fromarray(image_data)
        
        inputs = self.processor(images=pil_image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        return {
            "inputs": inputs,
            "original_size": (height, width),
            "crs": crs,
            "transform": transform,
            "bounds": bounds,
            "georeferenced": georeferenced
        }

    def predict(self, preprocessed_data):
        """Runs the image through the segmentation model."""
        start_time = time.time()
        
        with torch.no_grad():
            outputs = self.model(**preprocessed_data["inputs"])
            
        logits = outputs.logits
        upsampled_logits = torch.nn.functional.interpolate(
            logits,
            size=preprocessed_data["original_size"],
            mode="bilinear",
            align_corners=False
        )
        
        predictions = upsampled_logits.argmax(dim=1).squeeze().cpu().numpy()
        
        inference_time = time.time() - start_time
        return {
            "predictions": predictions,
            "inference_time": inference_time
        }

    def postprocess_mask(self, prediction_result):
        """Extracts the binary mask for the target class and removes small noise."""
        predictions = prediction_result["predictions"]
        # ONLY use the building class
        binary_mask = (predictions == self.target_class_idx).astype(np.uint8)
        
        # 1. Morphological opening to remove tiny noise (e.g. 3x3 or 5x5)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        clean_mask = cv2.morphologyEx(binary_mask, cv2.MORPH_OPEN, kernel)
        
        # 2. Morphological closing to fill small holes inside buildings
        clean_mask = cv2.morphologyEx(clean_mask, cv2.MORPH_CLOSE, kernel)
        
        # 3. Connected Components filtering to remove remaining small blobs (area threshold)
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(clean_mask, connectivity=8)
        
        final_mask = np.zeros_like(clean_mask)
        # Sensible area threshold (e.g. 100 pixels minimum for a building)
        min_area_pixels = 100 
        
        for i in range(1, num_labels): # Skip background label 0
            if stats[i, cv2.CC_STAT_AREA] >= min_area_pixels:
                final_mask[labels == i] = 1
                
        return final_mask * 255

    def polygonize(self, mask, transform):
        """Converts the binary mask into raw vector polygons."""
        polygons = []
        for geom, val in shapes(mask, mask=(mask > 0), transform=transform):
            polygons.append(shape(geom))
        return polygons

    def validate_polygons(self, polygons):
        """Validates and simplifies polygon geometries."""
        valid_polygons = []
        for poly in polygons:
            if not poly or poly.is_empty:
                continue
                
            if not poly.is_valid:
                poly = make_valid(poly)
                
            if isinstance(poly, Polygon) and poly.area > 0:
                valid_polygons.append(poly)
            elif isinstance(poly, MultiPolygon):
                for p in poly.geoms:
                    if p.area > 0:
                        valid_polygons.append(p)
                        
        return valid_polygons

    def extract_buildings(self, image_path: str, filename: str) -> dict:
        """Main pipeline orchestration."""
        total_start_time = time.time()
        
        self.load_model()
        
        preprocessed = self.preprocess_image(image_path)
        prediction = self.predict(preprocessed)
        mask = self.postprocess_mask(prediction)
        polygons = self.polygonize(mask, preprocessed["transform"])
        valid_polygons = self.validate_polygons(polygons)
        
        features = []
        for i, poly in enumerate(valid_polygons):
            features.append({
                "type": "Feature",
                "properties": {
                    "building_id": i + 1,
                    "area": poly.area,
                    "perimeter": poly.length,
                    "geometry_valid": True,
                    "source": "AI_Extraction",
                    "model": self.model_id
                },
                "geometry": poly.__geo_interface__
            })
            
        total_time = time.time() - total_start_time
        
        return {
            "status": "SUCCESS",
            "source": {
                "filename": filename,
                "georeferenced": preprocessed["georeferenced"],
                "crs": preprocessed["crs"],
                "bounds": preprocessed["bounds"] if preprocessed["georeferenced"] else [0, 0, preprocessed["original_size"][1], preprocessed["original_size"][0]],
                "width": preprocessed["original_size"][1],
                "height": preprocessed["original_size"][0]
            },
            "model": {
                "id": self.model_id,
                "architecture": "SegFormer",
                "device": self.device
            },
            "metrics": {
                "buildings_detected": len(polygons),
                "valid_polygons": len(valid_polygons),
                "inference_time_seconds": round(prediction["inference_time"], 3),
                "total_processing_time_seconds": round(total_time, 3)
            },
            "features": features
        }

inference_service = BuildingSegmentationInference()
