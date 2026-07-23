import requests
import json

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
TASK_ID = "aa2a93c4-db68-49ce-ae46-d878e7998d5a"
POLL_URL = f"https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro/{TASK_ID}"

print("Polling...")
resp = requests.get(POLL_URL, headers={"x-magnific-api-key": API_KEY}, timeout=30)
print(f"Status: {resp.status_code}")
data = resp.json()
print(json.dumps(data, indent=2)[:2000])
