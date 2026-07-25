import requests
import time
import json
import os

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

prompts = [
    ("descent-3x3.claude-img.txt", "descent-3x3.png"),
    ("descent-gaps-3x3.claude-img.txt", "descent-gaps-3x3.png")
]

for prompt_file, output_name in prompts:
    print(f"\n=== Generating: {prompt_file} ===")
    with open(prompt_file, encoding='utf-8') as f:
        raw = f.read().strip()

    # Compress if needed
    if len(raw) > 2990:
        print(f"Prompt too long ({len(raw)} chars). Compressing...")
        raw = raw[:2950]
        raw = raw[:raw.rfind('.')+1]
        print(f"Compressed to {len(raw)} chars")

    payload = {
        "prompt": raw,
        "model": "nano-banana-pro",
        "resolution": "2K"
    }
    headers = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}

    r = requests.post(ENDPOINT, json=payload, headers=headers, timeout=30)
    data = r.json()
    print(f"Response keys: {list(data.keys())}")

    inner = data.get("data") or data
    task_id = inner.get("task_id")

    if not task_id:
        print(f"ERROR: No task_id. Full response: {json.dumps(data)[:500]}")
        continue

    print(f"task_id: {task_id}")

    # Poll
    poll_url = f"{ENDPOINT}/{task_id}"
    for i in range(30):
        time.sleep(5)
        pr = requests.get(poll_url, headers=headers, timeout=30)
        pd = pr.json()
        sd = pd.get("data") or pd
        status = str(sd.get("status", "")).upper()
        print(f"  Poll {i+1}: {status}")
        if status == "COMPLETED":
            result_url = sd.get("output_url") or sd.get("result_url") or sd.get("url")
            if result_url:
                print(f"  Success! URL: {result_url}")
                img = requests.get(result_url, timeout=60)
                with open(output_name, "wb") as f:
                    f.write(img.content)
                size = os.path.getsize(output_name)
                print(f"  Saved {output_name} ({size} bytes)")
            else:
                print(f"  No output URL found. Keys: {list(sd.keys())[:10]}")
            break
        elif status in ("FAILED", "ERROR", "REJECTED"):
            print(f"  Generation failed: {status}")
            break
    else:
        print("  Timed out waiting for completion")

print("\nDone.")
