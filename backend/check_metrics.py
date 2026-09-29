import torch
import torch.nn.functional as F
from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor
from PIL import Image
import time
import cv2
import numpy as np
import glob

model_id = "tomascanivari/segformer-b0-finetuned-buildings"
model = SegformerForSemanticSegmentation.from_pretrained(model_id)
processor = SegformerImageProcessor.from_pretrained(model_id)

files = glob.glob('../data/uploads/*.png')
img = Image.open(files[0]).convert("RGB")

t0 = time.time()
inputs = processor(images=img, return_tensors="pt")

with torch.no_grad():
    outputs = model(**inputs)

logits = outputs.logits
upsampled_logits = F.interpolate(logits, size=(1024, 1536), mode="bilinear", align_corners=False)
predictions = upsampled_logits.argmax(dim=1).squeeze().numpy()
inference_time = time.time() - t0

binary_mask = (predictions == 1).astype(np.uint8) * 255
num_pixels = np.sum(predictions == 1)
total_pixels = 1024 * 1536
percentage = (num_pixels / total_pixels) * 100

print(f"Inference time: {inference_time:.3f}s")
print(f"Mask area: {num_pixels} / {total_pixels} pixels ({percentage:.2f}%)")
