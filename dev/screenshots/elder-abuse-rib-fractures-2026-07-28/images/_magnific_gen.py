import base64, json, os, sys, time, requests

CASE = "elder-abuse-rib-fractures"
OUT = os.path.join(r"C:\Users\steve\MeWorld\dev\screenshots", f"elder-abuse-rib-fractures-2026-07-28", "images")
os.makedirs(OUT, exist_ok=True)

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

REF_PATH = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(REF_PATH, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode()

PLATES = [
    ("descent-3x3", "elder-abuse-rib-fractures-descent-3x3.png"),
    ("descent-gaps-3x3", "elder-abuse-rib-fractures-gaps-3x3.png"),
]

for prompt_key, out_name in PLATES:
    prompt = open(os.path.join(OUT, f"{prompt_key}.claude-img.txt"), encoding="utf-8").read()
    print(f"\n--- {prompt_key}: {len(prompt)} chars ---")
    assert len(prompt) <= 2995, f"PROMPT TOO LONG ({prompt_key}): {len(prompt)} chars"
    
    payload = {
        "prompt": prompt,
        "resolution": "2K",
        "reference_images": [
            {"image": ref_b64, "mime_type": "image/png"}
        ]
    }
    print(f"Submitting {prompt_key} to Magnific...")
    resp = requests.post(ENDPOINT, json=payload, headers={"x-magnific-api-key": API_KEY, "Content-Type": "application/json"})
    data = resp.json()
    tid = (data.get("data") or data).get("task_id")
    print(f"Task ID: {tid}")
    
    for i in range(120):
        time.sleep(5)
        status_resp = requests.get(f"{ENDPOINT}/{tid}", headers={"x-magnific-api-key": API_KEY})
        status_data = status_resp.json()
        status = (status_data.get("data") or status_data).get("status", "")
        print(f"  Poll {i+1}: status={status}")
        if status.upper() == "COMPLETED":
            generated = (status_data.get("data") or status_data).get("generated", [])
            if generated:
                url = generated[0]
                print(f"  Downloading: {url}")
                img = requests.get(url).content
                out_path = os.path.join(OUT, out_name)
                with open(out_path, "wb") as f:
                    f.write(img)
                print(f"  Saved: {out_path} ({len(img)} bytes)")
            break
        elif status.upper() == "FAILED":
            print(f"  FAILED: {json.dumps(status_data, indent=2)}")
            break
    else:
        print(f"  TIMEOUT on {prompt_key}")

print("\nAll plates complete.")
