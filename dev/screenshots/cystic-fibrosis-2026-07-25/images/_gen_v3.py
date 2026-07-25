import requests, time, os, json, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUTDIR = os.path.dirname(os.path.abspath(__file__))
HEADERS = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}

# Load the Uncharted 4 style reference image
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_bytes = f.read()
ref_b64 = base64.b64encode(ref_bytes).decode("ascii")
ref_data_url = f"data:image/png;base64,{ref_b64}"
print(f"Reference image loaded ({len(ref_bytes)} bytes)", flush=True)

pairs = [
    ("descent-3x3.v2.txt", "descent-3x3-v3.png"),
    ("descent-gaps-3x3.v2.txt", "descent-gaps-3x3-v3.png"),
]

for prompt_file, out_name in pairs:
    prompt_path = os.path.join(OUTDIR, prompt_file)
    with open(prompt_path, encoding="utf-8", errors="replace") as f:
        raw = f.read().strip()

    if len(raw) > 2990:
        print(f"Compressing {prompt_file} from {len(raw)} chars...", flush=True)
        raw = raw[:2950]
        raw = raw[:raw.rfind(".") + 1]
        print(f"Compressed to {len(raw)} chars", flush=True)

    print(f"\n=== {prompt_file} ({len(raw)} chars) ===", flush=True)

    payload = {
        "prompt": raw,
        "resolution": "2K",
        "reference_images": [
            {
                "image": ref_data_url,
                "mime_type": "image/png",
                "text": "Match this exact visual style, lighting, color palette, atmosphere, material quality, and composition. Cool blue-gray dominant ambient, warm amber focal accents, volumetric haze, lived-in worn surfaces, soft vignette. Naughty Dog cinematic CGI."
            }
        ],
    }

    r = requests.post(ENDPOINT, json=payload, headers=HEADERS, timeout=60)
    data = r.json()
    inner = data.get("data") or data
    task_id = inner.get("task_id")

    if not task_id:
        print(f"ERROR: No task_id. Response: {json.dumps(data)[:600]}", flush=True)
        continue

    print(f"task_id: {task_id}", flush=True)

    poll_url = f"{ENDPOINT}/{task_id}"
    for i in range(40):
        time.sleep(5)
        pr = requests.get(poll_url, headers=HEADERS, timeout=30)
        pd = pr.json()
        sd = pd.get("data") or pd
        status = str(sd.get("status", "")).upper()
        print(f"  poll {i+1}: {status}", flush=True)

        if status == "COMPLETED":
            gen = sd.get("generated", [])
            if isinstance(gen, list) and len(gen) > 0:
                url = gen[0]
                print(f"  URL: {url[:100]}...", flush=True)
                img = requests.get(url, timeout=60)
                out_path = os.path.join(OUTDIR, out_name)
                with open(out_path, "wb") as f:
                    f.write(img.content)
                print(f"  SAVED {out_name} ({os.path.getsize(out_path)} bytes)", flush=True)
            else:
                print(f"  No generated URLs. Keys: {list(sd.keys())[:10]}", flush=True)
            break
        elif status in ("FAILED", "ERROR", "REJECTED"):
            print(f"  FAILED: {json.dumps(sd)[:600]}", flush=True)
            break
    else:
        print(f"  TIMEOUT after 40 polls", flush=True)

print("\nDone.", flush=True)
