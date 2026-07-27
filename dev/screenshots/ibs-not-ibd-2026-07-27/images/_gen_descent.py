import requests, time, os, base64
API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT_DIR = r"C:\Users\steve\MeWorld\dev\screenshots\ibs-not-ibd-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
os.makedirs(OUT_DIR, exist_ok=True)
with open(ref_path,"rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = """Naughty Dog Uncharted 4 cinematic CGI. 3x3 grid, 9 panels. Warm office lighting, 35mm lens, film grain, desaturated amber.

Panel 1: Split scene. Left: well-looking patient in exam room, sitting upright, abdomen cramping but no cachexia. Right: cachectic patient with NG tube, pale, systemically ill. Red line divides. Label: IBS vs IBD.

Panel 2: Colon wall layers. Left: intact mucosa with glowing yellow hyperactive nerves sparking. Middle: normal. Right: deep ulceration, crypt abscesses, transmural red inflammation. Label: Hypersensitive Nerves vs Destroyed Tissue.

Panel 3: Brain-gut axis. Translucent brain with glowing amygdala and cingulate cortex connected by illuminated vagus nerve to hyperactive colon. Cortisol molecules float along pathway. Label: Brain-Gut Axis Dysregulation.

Panel 4: Three lab reports on desk all showing NORMAL in red. CBC normal, CRP normal, stool negative. Physician hand rests calmly. Rome IV criteria card beside them. Label: Normal Labs Expected in IBS.

Panel 5: Colonoscopy monitor showing pristine pink colon, normal vascular pattern, no ulcers, no bleeding. Endoscope light illuminates evenly. Check mark on screen. Label: Clean Scope Rules Out IBD.

Panel 6: Gut microscopy split. Left: mast cells releasing histamine near nerve ending. Right: neutrophilic infiltration with crypt abscess and granuloma. Label: Mast Cells Irritate · Neutrophils Destroy.

Panel 7: Medical tray with urine cup, blood culture bottle, and ESR tube each with red X through them. Hand pushes aside to reveal prescription pad and fiber bottle underneath. Label: What Not to Order.

Panel 8: Physician talking calmly to patient in warm office. Wall diagram shows treatment: fiber, loperamide, dicyclomine, diet, follow-up. Label: Treatment = Reassurance + Gut Modulators.

Panel 9: Patient walking out of clinic into morning sunlight, holding prescription and fiber supplement, relaxed expression. Building fades behind. Label: IBS is Clinical Diagnosis · Rule Out Mimics · Then Stop.

Photoreal, no cartoon, no flat design, Naughty Dog quality, volumetric lighting."""

print(f"Descent: {len(prompt)} chars", flush=True)
b = {"prompt": prompt, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}
h = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}
r = requests.post(ENDPOINT, json=b, headers=h, timeout=60)
d = (r.json().get("data") or r.json()); tid = d.get("task_id")
print(f"Task: {tid}", flush=True)
s = "pending"
while s.upper() not in ("COMPLETED","FAILED","CANCELLED"):
    time.sleep(10)
    sr = requests.get(f"{ENDPOINT}/{tid}", headers=h, timeout=30)
    sd = (sr.json().get("data") or sr.json()); s = str(sd.get("status","")).upper()
    print(f"  {s}", flush=True)
if s == "COMPLETED":
    urls = sd.get("generated",[]); url = urls[0] if isinstance(urls[0],str) else urls[0].get("url",""); r2 = requests.get(url, timeout=120)
    out = os.path.join(OUT_DIR, "descent-3x3.png")
    with open(out,"wb") as f: f.write(r2.content)
    print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
else: print(f"Status: {s}", flush=True)
