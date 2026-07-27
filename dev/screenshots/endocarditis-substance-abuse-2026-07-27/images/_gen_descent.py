import requests, time, os, base64
API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT_DIR = r"C:\Users\steve\MeWorld\dev\screenshots\endocarditis-substance-abuse-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
os.makedirs(OUT_DIR, exist_ok=True)
with open(ref_path,"rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = """Naughty Dog Uncharted 4 cinematic CGI style. 3x3 grid, 9 equal panels. Dark moody ED bay lighting, volumetric fog, film grain, 35mm lens, desaturated teal-and-amber grade.

PANEL 1 (TOP LEFT): 45-year-old woman lies on ED stretcher, IV pole beside her, monitor showing tachycardia 110 bpm, temp 39.2C. She looks unwell, flushed, diaphoretic, track marks visible on her forearms. Overhead surgical light casts dramatic shadows. Label: "45F · Fever · Malaise · IVDU"

PANEL 2 (TOP MIDDLE): Close macro shot of an aortic valve with vegetation — golden-brown friable mass clinging to the leaflet, surrounded by turbulent blood flow rendered as swirling crimson with particle effects. Anatomically precise. Label: "Vegetation on Aortic Valve"

PANEL 3 (TOP RIGHT): Blood culture bottles on a lab bench — three sets, aerobic and anaerobic, illuminated by warm amber lab light. A lab technician's gloved hand holds a Gram-stained slide up to the light, revealing purple Gram-positive cocci in clusters. Label: "Blood Cultures x3 · Gram Stain"

PANEL 4 (MIDDLE LEFT): Split-composition comparison. Left side shows a purple Gram-positive coccus with thick peptidoglycan wall diagram. Right side shows the same but pink Gram-negative with outer membrane. Light beam separates them. Label: "Gram + = Staph · Gram — = HACEK"

PANEL 5 (MIDDLE): A kidney in cross-section, with wedge-shaped dark red infarcts scattered across the cortex, and a microscopic inset showing glomerulus with immune complex deposits (granular IgG and C3 along basement membrane). Label: "Renal Emboli · Immune Complex GN"

PANEL 6 (MIDDLE RIGHT): A vial labeled RPR on a counter next to a syringe. Behind it, a translucent anatomical heart shows syphilitic aortitis — dilated aortic root with tree-bark wrinkling of the intima. Label: "RPR Screen · Syphilitic Aortitis"

PANEL 7 (BOTTOM LEFT): A urinalysis dipstick with pads changing color — blood pad dark green (+++), protein pad teal (+), held by a physician's hand. Above it, floating translucent RBCs and a single RBC cast as scientific illustration. Label: "UA: Hematuria · RBC Casts"

PANEL 8 (BOTTOM MIDDLE): A pregnancy test stick showing two pink lines on an ED counter, next to a medication vial of vancomycin. Split view: left side shows crossed-out gentamicin box (pregnancy category D), right side shows green-checked ceftriaxone vial (category B). Label: "Pregnancy Test · Antibiotic Selection"

PANEL 9 (BOTTOM RIGHT): A balanced composition showing a bag of Lactated Ringer's infusing through IV tubing into the patient's arm, with a kidney diagram beside it showing preserved renal blood flow. Small text overlay: "LR = Cl 109 mEq/L · Less AKI than NS". Label: "Balanced Crystalloid · Renal Protection"

High production design. Cinematic lighting with volumetric god rays through ED bay windows. No cartoon, no flat illustration, no text-heavy slides. Photoreal CGI with Naughty Dog material quality."""

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
