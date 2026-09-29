import torch
import torchvision
import transformers
from transformers import SegformerImageProcessor, SegformerForSemanticSegmentation

print("Torch version:", torch.__version__)
print("Torchvision version:", torchvision.__version__)
print("Transformers version:", transformers.__version__)
print("CUDA available:", "YES" if torch.cuda.is_available() else "NO")

model_id = "nvidia/segformer-b0-finetuned-ade-512-512"
try:
    processor = SegformerImageProcessor.from_pretrained(model_id)
    model = SegformerForSemanticSegmentation.from_pretrained(model_id)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    print("Model loading: SUCCESS")
except Exception as e:
    print("Model loading: FAILED", str(e))
