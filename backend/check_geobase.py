from huggingface_hub import HfApi
import json

api = HfApi()
repo_id = "geobase/building-footprint-segmentation"
try:
    files = api.list_repo_files(repo_id=repo_id)
    print("Files in repo:")
    for f in files:
        print(f)
    
    if "config.json" in files:
        config_path = api.hf_hub_download(repo_id=repo_id, filename="config.json")
        with open(config_path, "r") as f:
            config = json.load(f)
            print("Model type:", config.get("model_type", "Unknown"))
            print(json.dumps(config, indent=2)[:500])

except Exception as e:
    print(e)
