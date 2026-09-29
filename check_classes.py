import os
from transformers import SegformerForSemanticSegmentation
from PIL import Image
import torch

model_id = "nvidia/segformer-b0-finetuned-ade-512-512"
model = SegformerForSemanticSegmentation.from_pretrained(model_id)

print("--- id2label mapping ---")
building_id = None
for k, v in model.config.id2label.items():
    if "building" in v.lower() or "house" in v.lower():
        print(f"Match: {k} -> {v}")
        if building_id is None:
            building_id = k

print(f"\nBuilding class ID is: {building_id}")

from transformers import SegformerImageProcessor
processor = SegformerImageProcessor.from_pretrained(model_id)

img_path = 'data/uploads/Demo-image.png'
# Just use any PNG file from data/uploads if Demo-image is not exactly that name
import glob
files = glob.glob('data/uploads/*.png')
if not files:
    print("No PNG found in data/uploads")
    exit(1)

img = Image.open(files[0]).convert("RGB")
inputs = processor(images=img, return_tensors="pt")

with torch.no_grad():
    outputs = model(**inputs)

logits = outputs.logits
predictions = logits.argmax(dim=1).squeeze().numpy()

unique, counts = torch.unique(torch.tensor(predictions), return_counts=True)
print("\n--- Predictions in image ---")
for u, c in zip(unique.tolist(), counts.tolist()):
    label = model.config.id2label.get(u, "Unknown")
    print(f"Class {u} ({label}): {c} pixels")
