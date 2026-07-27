import requests, time, os, base64
API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT_DIR = r"C:\Users\steve\MeWorld\dev\screenshots\ibs-not-ibd-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
os.makedirs(OUT_DIR, exist_ok=True)
with open(ref_path,"rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = """Naughty Dog Uncharted 4 cinematic CGI. 3x3 grid, 9 panels. Dark clinical lighting, volumetric fog, film grain, desaturated amber tone.

Panel 1: Urine specimen cup alone on metal table under harsh clinical light. Hand stamps NOT INDICATED in red. Behind, translucent bladder and urethra are normal, no infection. Label: UA Not Indicated · No Urinary Symptoms.

Panel 2: Three blood culture bottles lined up on lab counter, glowing dark red. Physician hand hesitates. Above, translucent circulatory system with clean blood. Infographic shows 3 percent false positive rate with red X. Label: Blood Culture Not Indicated · No Bacteremia.

Panel 3: ESR tube standing on bench, RBCs settling. Printout reads 35 borderline with question mark. Branching flowchart: chase it leads to confusion, ignore it leads to clinical diagnosis. Ignore path glows golden. Label: ESR Not Indicated · Creates False Trails.

Panel 4: Medical tray with three unnecessary items — urine cup, blood culture bottle, ESR tube — each with red cross. Hand sweeps aside revealing clean prescription pad, fiber bottle, Bristol stool chart. Label: Replace Fishing With Clinical Tools.

Panel 5: Colon wall split. Left: IBS with glowing yellow nerves penetrating muscularis, mast cells releasing histamine, epithelium intact. Right: IBD with deep ulceration, crypt abscesses, transmural red inflammation. Label: Nerves Fire · Tissue Destroyed.

Panel 6: Rome IV criteria card on desk under warm lamp light. Three checkboxes: abdominal pain checked, related to defecation checked, stool form change checked. Alarm features below with red text weight loss and rectal bleeding both crossed out. Label: Rome IV = Clinical Diagnosis.

Panel 7: Well-nourished patient sitting calmly in exam room. Physician gestures toward treatment diagram: fiber, loperamide, dicyclomine, diet, follow-up. Warm ambient light. Label: Treatment = Reassurance + Gut Modulators.

Panel 8: Macro shot of colonoscopy monitor displaying pristine pink colon, normal vascular pattern, no ulceration, no bleeding. Check mark on screen. Label: Clean Colonoscopy Rules Out IBD.

Panel 9: Patient walking out of clinic into warm morning light, holding prescription and fiber supplement, relaxed. Clinic fades behind. Calendar shows 2-week follow-up. Label: Rule Out Mimics · Then Stop.

Photoreal, no cartoon, no flat design, Naughty Dog material quality, cinematic."""

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
