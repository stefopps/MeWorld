import requests, time, os, base64
API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT_DIR = r"C:\Users\steve\MeWorld\dev\screenshots\endocarditis-substance-abuse-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
os.makedirs(OUT_DIR, exist_ok=True)
with open(ref_path,"rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = """Naughty Dog Uncharted 4 cinematic CGI. 3x3 grid, 9 panels. Dark surgical lighting, volumetric fog, film grain, desaturated teal-amber grade.

Panel 1: Blood culture bottle (dark red, aerobic) and bacterial culture swab in transport tube sit on metal tray. Physician hand reaches for both. Translucent circulatory system shows bacteria moving from arm wound through veins to heart valve. Label: Blood vs Bacterial Culture.

Panel 2: Gram-positive Staph aureus cocci in purple grape-like clusters under dramatic macro lighting, one cluster with gold rim highlight. Beside it, valve vegetation cross-section shows same cocci in fibrin mesh.

Panel 3: RPR card on counter. Treponema pallidum as silver corkscrew under dark-field. Behind, translucent heart shows aortic root dilated with tree-bark intimal wrinkling. Label: Syphilitic Aortitis.

Panel 4: UA dipstick under lab light: blood pad dark green, protein pad teal. Floating above, glomerulus with granular immune deposits and dysmorphic RBCs squeezing through basement membrane.

Panel 5: Pregnancy test with two pink lines on ED tray. Beside it, crossed-out gentamicin box (Cat D), green-checked ceftriaxone vial (Cat B). Translucent early gestational sac above.

Panel 6: LR bag (109 mEq/L) and NS bag (154 mEq/L) on IV pole. Below, kidney split: saline kidney pale and vasoconstricted, LR kidney bright red with preserved flow. Small chloride comparison graph.

Panel 7: Split composition. Left: vegetation shedding emboli particles through arteries. Right: emboli landing as dark infarcts in brain, kidney, spleen, skin.

Panel 8: Physician holds Gram stain slide to light, purple staining visible. Beside: flowchart Gram+ clusters > Vancomycin > ID consult > Echo > Surgery. Path glows golden.

Panel 9: Wide ED bay shot. Patient on stretcher, IV running, vitals stable. Wall clock visible. Attending writes in chart. Warm amber light through gloom.

No cartoon, no flat design, no cheerful colors. Photoreal Naughty Dog material quality."""

print(f"Gaps: {len(prompt)} chars", flush=True)
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
    out = os.path.join(OUT_DIR, "descent-gaps-3x3.png")
    with open(out,"wb") as f: f.write(r2.content)
    print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
else: print(f"Status: {s}", flush=True)
