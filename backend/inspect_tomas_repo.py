import sys
from huggingface_hub import hf_hub_download

repo_id = "tomascanivari/segformer-b0-finetuned-buildings"
try:
    readme_path = hf_hub_download(repo_id=repo_id, filename="README.md")
    with open(readme_path, "r", encoding="utf-8") as f:
        text = f.read()
        sys.stdout.buffer.write(text.encode('utf-8'))
except Exception as e:
    print(e)
