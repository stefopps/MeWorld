import requests, time, os, base64
API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT = r"C:\Users\steve\MeWorld\dev\screenshots\infective-endocarditis-ivdu-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path,"rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray ambient lighting. Heavy ambient occlusion. Volumetric haze. Soft vignette. "
"3x2 grid, 6 panels, landscape 16:9. NO TEXT ANYWHERE. Clinical environment. "
"Panel 1: Through Object In. Vancomycin IV bag unspiked on IV pole, tubing disconnected. Penicillin vial empty on tray, clindamycin bottle also used. The gap: the correct MRSA antibiotic never hung. Three wrong antibiotics chosen. "
"Panel 2: Low angle macro. Aspirin tablet crushed on bedside, blood visible at microscopic level, platelets unable to aggregate, cerebral vessel wall weakened, small hemorrhage beginning. The gap: aspirin is contraindicated in endocarditis, increases hemorrhagic stroke risk. "
"Panel 3: Worm's-Eye View. Empty urine specimen cup, no urinalysis collected. Empty pregnancy test stick unused. Empty STD swab tubes. The gap: sepsis source missed, risk screening not done on high-risk patient. "
"Panel 4: Push in. CBC tube unfilled, BMP tube empty on tray, pulse oximeter sensor hanging loose. The gap: basic labs and vitals not ordered for a septic patient with qSOFA score of 2 or more. "
"Panel 5: Wide shot. Substance abuse consult order blank. Social services referral unsigned. Safe sex counseling pamphlet untouched. Naloxone kit sealed on shelf. The gap: zero preventive care, treating the infection but ignoring the addiction that caused it. "
"Panel 6: Dolly Zoom Out. Hospital room dim and still. ID consultation request slip blank. Patient alone. No social worker, no rehab plan, no follow-up. The gap: illness treated incompletely, human left behind. "
"Cinematic, high contrast, glossy detail, consistent style, no text anywhere."
)
print(f"Gaps: {len(prompt)} chars", flush=True)
b = {"prompt": prompt, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}
h = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}
r = requests.post(ENDPOINT, json=b, headers=h, timeout=60)
d = (r.json().get("data") or r.json()); tid = d.get("task_id")
print(f"Task: {tid}", flush=True)
s = "pending"
while s.upper() not in ("COMPLETED","FAILED","CANCELLED"):
    time.sleep(10)
    sr = requests.get(f"https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro/{tid}", headers=h, timeout=30)
    sd = (sr.json().get("data") or sr.json()); s = str(sd.get("status","")).upper()
    print(f"  {s}", flush=True)
if s == "COMPLETED":
    urls = sd.get("generated",[]); url = urls[0] if isinstance(urls[0],str) else urls[0].get("url",""); r2 = requests.get(url, timeout=120)
    out = os.path.join(OUT, "descent-gaps-3x3.png")
    with open(out,"wb") as f: f.write(r2.content)
    print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
else: print(f"Status: {s}", flush=True)
