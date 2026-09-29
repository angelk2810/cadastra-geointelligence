FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for rasterio, GDAL, and OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgdal-dev gdal-bin \
    libgl1-mesa-glx libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the SegFormer model at build time so it's cached in the image
# This avoids ~60s cold-start delay on first request
RUN python -c "\
from transformers import SegformerImageProcessor, SegformerForSemanticSegmentation; \
SegformerImageProcessor.from_pretrained('tomascanivari/segformer-b0-finetuned-buildings'); \
SegformerForSemanticSegmentation.from_pretrained('tomascanivari/segformer-b0-finetuned-buildings')"

COPY app/ ./app/

# Create data directories
RUN mkdir -p /app/data/uploads /app/data/outputs

# Railway injects PORT env var; default to 8000
ENV PORT=8000
EXPOSE ${PORT}

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
