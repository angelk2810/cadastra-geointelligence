# CadastraAI - Tech Stack & Workflow Architecture

CadastraAI is a high-end geospatial intelligence platform designed for AI-assisted urban mapping and cadastral feature extraction. This document outlines the core technology stack and the operational workflow of the platform.

## 🛠️ Technology Stack

### Frontend (Client-Side)
- **Framework**: React 18 with Vite for lightning-fast HMR and optimized builds.
- **Styling & UI**: Tailwind CSS (with a custom premium dark GIS theme), Lucide React (for iconography).
- **Geospatial Rendering**: OpenLayers (`ol`) is the core engine used for rendering both georeferenced aerial imagery (TIFF/PNG) and vector layers (GeoJSON polygons) simultaneously.
- **Routing**: React Router DOM for SPA navigation.
- **State Management**: React Context API (`ProjectContext`) and `localStorage` for robust session persistence during geospatial reviews.

### Backend (Server-Side)
- **Framework**: FastAPI (Python), served via Uvicorn for high-performance asynchronous API endpoints.
- **Geospatial Processing**: 
  - `rasterio`: Used for reading image metadata, checking geotransforms (CRS), and handling raster datasets.
  - `shapely`: Used extensively for topological geometry validation, polygon manipulation, and GeoJSON structural integrity.
- **Testing**: `pytest` for endpoint and ML integration testing.

### AI & Machine Learning Pipeline
- **Core Model Architecture**: SegFormer (via Hugging Face `transformers`), specifically optimized for semantic segmentation on aerial/satellite imagery.
- **Deep Learning Frameworks**: PyTorch & Torchvision.
- **Inference Pipeline**: Custom inference service that loads the model, processes image tensors, generates segmentation masks, and mathematically translates the raw raster masks into vector boundaries (polygons).

---

## 🔄 Operational Workflow

### 1. Data Ingestion (Upload)
- The user uploads an aerial orthophoto or drone imagery via the dashboard. 
- The backend API (`/api/upload`) stores the file locally.
- The system automatically detects whether the image contains valid spatial reference information (Georeferenced vs Non-Georeferenced).

### 2. AI Inference & Polygonization
- The backend (`/api/extract`) loads the uploaded image into the AI inference engine.
- The **SegFormer** model predicts the semantic probabilities for buildings across the image.
- A contouring algorithm converts the high-probability raster pixels into distinct vector shapes.
- `shapely` validates each generated shape ensuring there are no self-intersections or empty areas.
- The extracted geometries are packaged into a standard `GeoJSON` FeatureCollection and returned to the frontend.

### 3. GIS Command Center (Review Mode)
- The frontend loads the `GISReview.tsx` panel. 
- **OpenLayers** generates a multi-layer map:
  - **Bottom Layer**: The raw uploaded aerial image (rendered via `StaticImage` using exact pixel extents or CRS).
  - **Top Layer**: The AI-extracted polygons rendered as an interactive Vector layer.
- **Surveyor Interaction**: The surveyor clicks on individual predicted buildings to view metadata. They can:
  - **ACCEPT**: Confirm the AI extraction.
  - **REJECT**: Mark the geometry as a false positive (it will be visually distinct and excluded from final exports).
  - **EDIT**: (Future/Ongoing) Modify the vertices of the polygon.
  - **ACCEPT REMAINING**: A bulk action to finalize the review process after false positives are rejected.

### 4. Ground-Truth Evaluation (Optional)
- If a ground-truth dataset is provided, the backend (`/api/evaluate`) compares the AI predictions against the true geometries.
- Quantitative metrics such as **IoU (Intersection over Union)**, **Precision**, **Recall**, and **F1 Score** are calculated and displayed in real-time on the dashboard.

### 5. Final Delivery (Export)
- Once the GIS review is complete, the frontend packages all `ACCEPTED` and `EDITED` polygons.
- The data is structured into a clean `GeoJSON` file preserving spatial references.
- The file is exported (`/api/export_features`) and downloaded directly to the surveyor's machine, ready for integration into traditional GIS tools like QGIS or ArcGIS.
