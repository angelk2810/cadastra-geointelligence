import json
from PIL import Image

try:
    with open('data/uploads/76cf75b6-600f-4d34-9770-a762279b2a38.png', 'rb') as f:
        img = Image.open(f)
        print("Image dimensions:", img.size)

    with open('data/outputs/out_76cf75b6-600f-4d34-9770-a762279b2a38.png.geojson', 'r') as f:
        data = json.load(f)
        min_y = float('inf')
        max_y = float('-inf')
        for feature in data.get('features', []):
            coords = feature['geometry']['coordinates'][0]
            for point in coords:
                y = point[1]
                min_y = min(min_y, y)
                max_y = max(max_y, y)
        print("Polygon Y bounds (min, max):", min_y, max_y)
except Exception as e:
    print(e)
