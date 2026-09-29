import urllib.request
import urllib.error
import json

url = "http://127.0.0.1:8000/api/extract"
payload = json.dumps({"filename": "76cf75b6-600f-4d34-9770-a762279b2a38.png"}).encode('utf-8')
req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Response:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("Failed with status:", e.code)
    print("Response:", e.read().decode('utf-8'))
except Exception as e:
    print("Failed to reach API:", e)
