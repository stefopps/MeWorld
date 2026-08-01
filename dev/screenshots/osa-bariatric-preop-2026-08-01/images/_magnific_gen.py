import base64, json, os, time, requests

OUT = r"C:\Users\steve\MeWorld\dev\screenshots\osa-bariatric-preop-2026-08-01\images"
API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
ref_b64 = base64.b64encode(open(r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png", "rb").read()).decode()

PLATES = [
    ("descent-3x3", "descent-3x3.png"),
    ("descent-gaps-3x3", "descent-gaps-3x3.png"),
]

for key, out_name in PLATES:
    prompt = open(os.path.join(OUT, f"{key}.claude-img.txt"), encoding="utf-8").read()
    print(f"\n--- {key}: {len(prompt)} chars ---")
    assert len(prompt) <= 2995, f"TOO LONG: {len(prompt)}"
    r = requests.post(
        ENDPOINT,
        json={"prompt": prompt, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]},
        headers={"x-magnific-api-key": API_KEY, "Content-Type": "application/json"},
    )
    data = r.json()
    tid = (data.get("data") or data).get("task_id")
    print(f"Task ID: {tid}")
    if not tid:
        print("NO TASK:", json.dumps(data)[:400])
        continue
    for i in range(60):
        time.sleep(5)
        d2 = requests.get(f"{ENDPOINT}/{tid}", headers={"x-magnific-api-key": API_KEY}).json()
        status = (d2.get("data") or d2).get("status", "")
        gen = (d2.get("data") or d2).get("generated", [])
        print(f"  Poll {i+1}: status={status} gen={len(gen) if gen else 0}")
        if status and status.upper() == "COMPLETED" and gen:
            img = requests.get(gen[0]).content
            path = os.path.join(OUT, out_name)
            open(path, "wb").write(img)
            print(f"  Saved: {path} ({len(img)} bytes)")
            break
        if status and status.upper() == "FAILED":
            print("  FAILED:", json.dumps(d2)[:300])
            break
    else:
        print("  TIMEOUT")

print("\nDone.")
