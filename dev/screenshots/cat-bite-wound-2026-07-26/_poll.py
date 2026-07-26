import requests, time, os

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
headers = {"x-magnific-api-key": API_KEY}

tasks = {
    "descent-3x3.png": "9cd2ebb3-4f9a-4161-a1a6-61a7c6fcb82b",
    "descent-gaps-3x3.png": "29505a03-01e5-49e3-a507-2e6316ede1bf"
}

out_dir = r"C:\Users\steve\MeWorld\dev\screenshots\cat-bite-wound-2026-07-26\images"

for out_name, task_id in tasks.items():
    poll_url = f"https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro/{task_id}"
    print(f"\nPolling {out_name}...", flush=True)
    status = "pending"
    while status not in ("COMPLETED", "FAILED", "CANCELLED"):
        time.sleep(10)
        sr = requests.get(poll_url, headers=headers, timeout=30)
        print(f"  HTTP {sr.status_code}", flush=True)
        try:
            j = sr.json()
            sd = j.get("data") or j
            status = str(sd.get("status", "")).upper()
            print(f"  Status: {status}", flush=True)
            if status == "COMPLETED":
                urls = sd.get("generated", [])
                if urls:
                    url = urls[0] if isinstance(urls[0], str) else urls[0].get("url", "")
                    print(f"  Downloading...", flush=True)
                    img_r = requests.get(url, timeout=120)
                    out = os.path.join(out_dir, out_name)
                    with open(out, "wb") as f:
                        f.write(img_r.content)
                    mb = os.path.getsize(out) / (1024*1024)
                    print(f"  SAVED: ({mb:.1f} MB)", flush=True)
            elif status in ("FAILED", "CANCELLED"):
                print(f"  Error: {sd.get('error','')}", flush=True)
        except Exception as e:
            print(f"  Parse err: {e}", flush=True)
            print(f"  Body: {sr.text[:200]}", flush=True)

print("\nDone.")
