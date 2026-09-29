import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import endpoints

app = FastAPI(title="CadastraAI API", version="1.0.0")

# Read allowed origins from env var (comma-separated), fallback to wildcard for all origins
raw_cors = os.getenv("CORS_ORIGINS", "*").strip()
if raw_cors == "*":
    cors_origins = ["*"]
    allow_creds = False
else:
    cors_origins = [o.strip() for o in raw_cors.split(",") if o.strip()]
    allow_creds = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost(:\d+)?",
    allow_credentials=allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(endpoints.router, prefix="/api")

@app.get("/")
def root():
    return {"message": "CadastraAI API is running"}
