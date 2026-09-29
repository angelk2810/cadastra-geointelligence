import torch
import torch.nn.functional as F
from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor
from PIL import Image

model_id = "nvidia/segformer-b0-finetuned-ade-512-512"
model = SegformerForSemanticSegmentation.from_pretrained(model_id)
processor = SegformerImageProcessor.from_pretrained(model_id)

img = Image.open('data/uploads/76cf75b6-600f-4d34-9770-a762279b2a38.png').convert("RGB")
inputs = processor(images=img, return_tensors="pt")

with torch.no_grad():
    outputs = model(**inputs)

logits = outputs.logits
upsampled_logits = F.interpolate(logits, size=(1024, 1536), mode="bilinear", align_corners=False)
predictions = upsampled_logits.argmax(dim=1).squeeze().numpy()

unique, counts = torch.unique(torch.tensor(predictions), return_counts=True)
print("\n--- Predictions in UPSAMPLED image ---")
for u, c in zip(unique.tolist(), counts.tolist()):
    label = model.config.id2label.get(u, "Unknown")
    print(f"Class {u} ({label}): {c} pixels")
