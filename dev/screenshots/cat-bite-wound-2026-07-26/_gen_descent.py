import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = """3x3 grid, cinematic cat bite wound descent. Naughty Dog cinematic CGI style, Uncharted 4 / The Last of Us visual language: golden-hour volumetric light, desaturated teal-amber palette, soft film grain, shallow depth of field.

PANEL 1: Night alley, stray cat bites man's lower leg, cat fleeing into shadows. Bluish streetlight, wet pavement.

PANEL 2: 24hrs later, bedroom. Man examining leg wound. Early redness and swelling, worried expression. Morning light through window.

PANEL 3: 72hrs, ER triage. Leg exposed on stretcher, green purulent discharge glistening, foul odor implied by nurse's expression. Feverish patient, overhead clinical light.

PANEL 4: Close-up of wound. Thick green exudate (Pseudomonas pyocyanin), surrounding cellulitis, necrotic edges. Medical lighting.

PANEL 5: Microbiology lab. Gram stain slide with rods and cocci visible. Four labeled pathogen cards: Pasteurella multocida, Pseudomonas aeruginosa, Bacteroides fragilis, Streptococcus anginosus.

PANEL 6: IV pole with Zosyn (piperacillin-tazobactam) bag. Clear fluid dripping into line. Clock showing hours advancing. Wound in background beginning to dry.

PANEL 7: Nurse infiltrating HRIG around wound margins with fine needle. Second nurse giving IM rabies vaccine in deltoid. Tetanus booster visible on tray.

PANEL 8: Portable X-ray of leg. Radiologist reviewing film. No retained fragments, no gas. Monitor showing "No foreign body. No subcutaneous gas."

PANEL 9: Recovery. Clean granulating wound, patient sitting up in hospital bed. Sunlight through window. Discharge papers on bedside table. Healing complete."""

print(f"Prompt: {len(prompt)} chars", flush=True)

payload = {
    "prompt": prompt,
    "resolution": "2K",
    "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]
}

headers = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}

print("Submitting...", flush=True)
r = requests.post(ENDPOINT, json=payload, headers=headers, timeout=60)
data = r.json()
task_data = data.get("data") or data
task_id = task_data.get("task_id")
task_path = task_data.get("task_path", "")
print(f"Task ID: {task_id}  Path: {task_path}", flush=True)

if not task_id:
    print(f"ERROR: {data}", flush=True)
    exit(1)

status = "pending"
while status.upper() not in ("COMPLETED", "FAILED", "CANCELLED"):
    time.sleep(10)
    poll_url = f"https://api.magnific.com{task_path}/{task_id}" if task_path else f"https://api.magnific.com/v1/tasks/{task_id}"
    sr = requests.get(poll_url, headers=headers, timeout=30)
    sd = (sr.json().get("data") or sr.json())
    status = str(sd.get("status", "")).upper()
    print(f"  Status: {status}", flush=True)

if status == "COMPLETED":
    urls = sd.get("generated", [])
    if urls:
        url = urls[0] if isinstance(urls[0], str) else urls[0].get("url", "")
        print(f"Downloading: {url[:80]}...", flush=True)
        img_r = requests.get(url, timeout=120)
        out = r"C:\Users\steve\MeWorld\dev\screenshots\cat-bite-wound-2026-07-26\images\descent-3x3.png"
        with open(out, "wb") as f:
            f.write(img_r.content)
        mb = os.path.getsize(out) / (1024*1024)
        print(f"SAVED: ({mb:.1f} MB)", flush=True)
else:
    print(f"FAILED: {status}", flush=True)
