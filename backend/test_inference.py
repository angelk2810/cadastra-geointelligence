import json
from app.ml.inference import BuildingSegmentationInference
import glob

inference = BuildingSegmentationInference()
files = glob.glob('../data/uploads/*.png')
if not files:
    print("No PNG found in ../data/uploads")
    exit(1)

res = inference.extract_buildings(files[0], "Demo-image.png")

print(f"Number of features generated: {len(res['features'])}")
