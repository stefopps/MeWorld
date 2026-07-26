import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = """3x3 grid, cat bite missed interventions teaching plate. Naughty Dog cinematic CGI, Uncharted 4 visual language: golden-hour volumetric light, teal-amber palette, soft film grain, shallow depth of field.

PANEL 1: Rabies virus particle (bullet-shaped Rhabdovirus). Label: "100% FATAL ONCE SYMPTOMATIC." Dark background, viral glow effect.

PANEL 2: Stray cat silhouette in alley, question mark overlay. Label: "ANIMAL UNAVAILABLE FOR OBSERVATION = FULL PEP REQUIRED."

PANEL 3: Close-up of HRIG infiltration. Fine needle injecting clear immunoglobulin around wound margins. Label: "HRIG: PASSIVE IMMUNITY (IMMEDIATE)."

PANEL 4: Vaccine vial labeled Rabies Vaccine IM. Syringe in deltoid. Calendar showing Day 0, 3, 7, 14. Label: "VACCINE: ACTIVE IMMUNITY (7-14 DAYS TO ANTIBODIES)."

PANEL 5: Clostridium tetani spore entering puncture wound. Synapse diagram showing tetanospasmin cleaving synaptobrevin (SNARE). Label: "TETANUS BOOSTER: >5 YEARS? BOOST NOW."

PANEL 6: Gram stain slide under microscope. Mixed Gram-negative rods (Pasteurella, Pseudomonas, Bacteroides) and Gram-positive cocci (Streptococcus). Label: "GRAM STAIN: IMMEDIATE PATHOGEN IDENTIFICATION."

PANEL 7: Leg X-ray viewbox. Radiologist's finger pointing. No retained fragments, no gas, no periosteal reaction. Label: "XR TIBIA/FIBULA: RULE OUT TOOTH FRAGMENTS, SUBCUTANEOUS GAS, FOREIGN BODY."

PANEL 8: Augmentin pill crossed out with red X. Pseudomonas colony resistant. Label: "AUGMENTIN FAILS HERE: Pseudomonas AmpC beta-lactamase + efflux pumps = intrinsic resistance."

PANEL 9: Three-threat triangle: ANTIBIOTICS in gold (done), RABIES PEP in red (missed), TETANUS BOOSTER in red (missed). Checkmark on one, X marks on two."""

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
        print(f"Downloading...", flush=True)
        img_r = requests.get(url, timeout=120)
        out = r"C:\Users\steve\MeWorld\dev\screenshots\cat-bite-wound-2026-07-26\images\descent-gaps-3x3.png"
        with open(out, "wb") as f:
            f.write(img_r.content)
        mb = os.path.getsize(out) / (1024*1024)
        print(f"SAVED: ({mb:.1f} MB)", flush=True)
else:
    print(f"FAILED: {status}", flush=True)
