import requests
import json

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
headers = {
    "x-magnific-api-key": API_KEY,
    "Content-Type": "application/json"
}

# Test 1: with model in body + lowercase 2k
payload1 = {
    "model": "nano-banana-pro",
    "prompt": "A cinematic Naughty Dog style 3x3 grid of 9 panels showing Crohn's disease progression, volumetric lighting, dark background",
    "aspect_ratio": "16:9",
    "resolution": "2k"
}
print("Test 1: model + 2k lowercase")
resp = requests.post(ENDPOINT, json=payload1, headers=headers, timeout=30)
print(f"Status: {resp.status_code}")
print(json.dumps(resp.json(), indent=2)[:500])

print("\n---\n")

# Test 2: with model in body + 2K uppercase
payload2 = {
    "model": "nano-banana-pro", 
    "prompt": "A cinematic Naughty Dog style 3x3 grid of 9 panels showing Crohn's disease progression, volumetric lighting, dark background",
    "aspect_ratio": "16:9",
    "resolution": "2K"
}
print("Test 2: model + 2K uppercase")
resp2 = requests.post(ENDPOINT, json=payload2, headers=headers, timeout=30)
print(f"Status: {resp2.status_code}")
print(json.dumps(resp2.json(), indent=2)[:500])

print("\n---\n")

# Test 3: no resolution (let API default)
payload3 = {
    "model": "nano-banana-pro",
    "prompt": "A cinematic Naughty Dog style 3x3 grid of 9 panels showing Crohn's disease progression, volumetric lighting, dark background",
    "aspect_ratio": "16:9"
}
print("Test 3: model + no resolution")
resp3 = requests.post(ENDPOINT, json=payload3, headers=headers, timeout=30)
print(f"Status: {resp3.status_code}")
print(json.dumps(resp3.json(), indent=2)[:500])
