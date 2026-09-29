from transformers import SegformerForSemanticSegmentation
import json

try:
    model_id = "tomascanivari/segformer-b0-finetuned-buildings"
    model = SegformerForSemanticSegmentation.from_pretrained(model_id)
    print("Model loaded successfully.")
    print("id2label mapping:")
    print(json.dumps(model.config.id2label, indent=2))
except Exception as e:
    print(f"Error loading model: {e}")
