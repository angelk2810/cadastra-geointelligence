from huggingface_hub import HfApi

api = HfApi()
models = api.list_models(search="building", filter="transformers", limit=20)
for m in models:
    print(f"ID: {m.id}, Tags: {m.tags}")
