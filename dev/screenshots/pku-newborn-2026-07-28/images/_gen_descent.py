import base64, json, os, sys, time, requests

CASE = "pku-newborn"
OUT = os.path.join(r"C:\Users\steve\MeWorld\dev\screenshots", f"pku-newborn-2026-07-28", "images")
os.makedirs(OUT, exist_ok=True)

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

REF_PATH = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(REF_PATH, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode()

PROMPT = open(os.path.join(OUT, "descent-3x3.claude-img.txt"), encoding="utf-8").read()
print(f"Prompt length: {len(PROMPT)} chars")
assert len(PROMPT) <= 2995, f"PROMPT TOO LONG: {len(PROMPT)}"

payload = {
    "prompt": PROMPT,
    "resolution": "2K",
    "reference_images": [
        {"image": ref_b64, "mime_type": "image/png"}
    ]
}
print("Submitting to Magnific...")
resp = requests.post(ENDPOINT, json=payload, headers={"x-magnific-api-key": API_KEY, "Content-Type": "application/json"})
data = resp.json()
print(json.dumps(data, indent=2))
tid = (data.get("data") or data).get("task_id")
print(f"Task ID: {tid}")

for i in range(120):
    time.sleep(5)
    status_resp = requests.get(f"{ENDPOINT}/{tid}", headers={"x-magnific-api-key": API_KEY})
    status_data = status_resp.json()
    status = (status_data.get("data") or status_data).get("status", "")
    print(f"Poll {i+1}: status={status}")
    if status.upper() == "COMPLETED":
        generated = (status_data.get("data") or status_data).get("generated", [])
        if generated:
            url = generated[0]
            print(f"Downloading: {url}")
            img = requests.get(url).content
            out_path = os.path.join(OUT, f"pku-newborn-descent-3x3.png")
            with open(out_path, "wb") as f:
                f.write(img)
            print(f"Saved: {out_path} ({len(img)} bytes)")
        sys.exit(0)
    elif status.upper() == "FAILED":
        print("FAILED:", json.dumps(status_data, indent=2))
        sys.exit(1)

print("TIMEOUT")
sys.exit(1)
