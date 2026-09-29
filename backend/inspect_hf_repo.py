from huggingface_hub import HfApi
import json

api = HfApi()
repo_id = "Abhatta7/building-footprint-segmentation"
try:
    files = api.list_repo_files(repo_id=repo_id)
    print("Files in repo:")
    for f in files:
        print(f)
        
    print("\nAttempting to read config.json if present...")
    if "config.json" in files:
        config_path = api.hf_hub_download(repo_id=repo_id, filename="config.json")
        with open(config_path, "r") as f:
            config = json.load(f)
            print(json.dumps(config, indent=2))
            
    print("\nAttempting to read README.md if present...")
    if "README.md" in files:
        readme_path = api.hf_hub_download(repo_id=repo_id, filename="README.md")
        with open(readme_path, "r", encoding="utf-8") as f:
            print(f.read()[:1000]) # First 1000 chars

except Exception as e:
    print(f"Error inspecting repository: {e}")
