import httpx
import json
import glob
import asyncio
import os

async def main():
    files = glob.glob('../data/uploads/*.png')
    if not files:
        print("No PNG found in data/uploads")
        return

    file_path = files[0]
    filename = os.path.basename(file_path)
    print(f"Testing with file: {filename}")

    url = 'http://127.0.0.1:8000/api/extract'
    payload = {"filename": filename}

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload)

    if response.status_code == 200:
        data = response.json()
        print("\n--- LIVE INFERENCE RESULTS ---")
        print("API Response SUCCESS")
        print("Model ID:", data["model"]["id"])
        print("Architecture:", data["model"]["architecture"])
        print("Device:", data["model"]["device"])
        print("Inference Time:", data["metrics"]["inference_time_seconds"])
        print("Detected Buildings:", data["metrics"]["buildings_detected"])
        print("Polygon Count:", len(data["features"]))
        print("Image dimensions:", data["source"]["width"], "x", data["source"]["height"])
    else:
        print(f"API Failed: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    asyncio.run(main())
