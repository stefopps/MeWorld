import requests
import time
import os
import sys
import json

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
HEADERS = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPT_FILE = os.path.join(SCRIPT_DIR, "descent-3x3.prompt.txt")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "descent-3x3.png")

# Read prompt
with open(PROMPT_FILE, "r", encoding="utf-8") as f:
    prompt = f.read().strip()

print(f"Prompt length: {len(prompt)} chars")

# Submit generation
body = {
    "prompt": prompt,
    "aspect_ratio": "16:9",
    "resolution": "2K",
}

print("Submitting to Magnific...")
resp = requests.post(ENDPOINT, headers=HEADERS, json=body)
print(f"POST status: {resp.status_code}")
raw_data = resp.json()
print(f"Full response: {json.dumps(raw_data, indent=2)[:8000]}")

# Try to find task_id in various places
task_id = None
if isinstance(raw_data, dict):
    task_id = raw_data.get("task_id") or raw_data.get("id") or raw_data.get("job_id")
    # Check nested data
    data = raw_data.get("data", {})
    if isinstance(data, dict):
        task_id = task_id or data.get("task_id") or data.get("id") or data.get("job_id")
    elif isinstance(data, str):
        task_id = task_id or data

if not task_id:
    print("ERROR: Could not find task_id in response")
    sys.exit(1)

print(f"Task ID: {task_id}")

# Poll until complete
poll_url = f"{ENDPOINT}/{task_id}"
print(f"Poll URL: {poll_url}")
print("Polling...", flush=True)

max_attempts = 120
for attempt in range(max_attempts):
    time.sleep(3)
    poll_resp = requests.get(poll_url, headers={"x-magnific-api-key": API_KEY})
    print(f"  Attempt {attempt + 1}: HTTP {poll_resp.status_code}", flush=True)
    
    if poll_resp.status_code != 200:
        print(f"  Response: {poll_resp.text[:500]}")
        if attempt >= 2:
            print("Too many poll failures, exiting")
            sys.exit(1)
        continue

    poll_data = poll_resp.json()
    inner = poll_data.get("data", poll_data)
    if isinstance(inner, dict):
        status = inner.get("status", poll_data.get("status", ""))
    else:
        status = poll_data.get("status", "")
    
    print(f"    status={status}", flush=True)

    if status.upper() == "COMPLETED":
        print("Generation complete!")
        generated = None
        # Search multiple locations
        for source in [poll_data, inner] if isinstance(inner, dict) else [poll_data]:
            for k in ("generated", "output", "images", "results", "url", "image_url"):
                v = source.get(k) if isinstance(source, dict) else None
                if v:
                    generated = v if isinstance(v, list) else [v]
                    break
        
        if not generated:
            print(f"Poll data keys: {list(poll_data.keys())}")
            print(f"Full: {json.dumps(poll_data, indent=2)[:4000]}")
            sys.exit(1)

        image_url = generated[0] if isinstance(generated[0], str) else generated[0].get("url", "")
        if not image_url:
            print(f"generated[0]: {generated[0]}")
            sys.exit(1)

        print(f"Downloading from: {image_url}")
        img_resp = requests.get(image_url)
        img_resp.raise_for_status()

        with open(OUTPUT_FILE, "wb") as f:
            f.write(img_resp.content)

        file_size_kb = os.path.getsize(OUTPUT_FILE) / 1024
        print(f"\n{'='*60}")
        print(f"Saved: {OUTPUT_FILE}")
        print(f"File size: {file_size_kb:.1f} KB")
        print(f"Model: nano-banana-pro")
        print(f"Task ID: {task_id}")
        print(f"{'='*60}")
        sys.exit(0)

    elif status.upper() in ("FAILED", "ERROR", "CANCELLED"):
        print(f"Generation failed")
        print(f"Full: {json.dumps(poll_data, indent=2)[:4000]}")
        sys.exit(1)

print("Timed out waiting for generation")
sys.exit(1)
