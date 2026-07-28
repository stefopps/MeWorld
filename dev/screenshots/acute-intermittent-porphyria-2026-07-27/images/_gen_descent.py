import requests, time, os, base64
API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT_DIR = r"C:\Users\steve\MeWorld\dev\screenshots\acute-intermittent-porphyria-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
os.makedirs(OUT_DIR, exist_ok=True)
with open(ref_path,"rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = """Naughty Dog Uncharted 4 cinematic CGI. 3x3 grid, 9 panels. Clinical lighting, film grain, desaturated blue-amber grade, 35mm.

Panel 1: Patient on exam table clutching abdomen, diaphoretic. IV pole D10W running. Monitor tachycardia. Lab printout: Na 131 highlighted. Label: Abdominal Pain + Psychiatric + Seizure + Paresthesias + Hyponatremia.

Panel 2: Heme synthesis pathway, 8 steps across mitochondria/cytoplasm. Step 3 PBGD in glowing red with broken chain. ALA/PBG accumulate at steps 1-2, can't proceed. Steps 4-8 pale. ALA synthase at step 1 with removed brake. Label: PBGD Deficiency · ALA/PBG Neurotoxic Accumulation.

Panel 3: Urine cup close-up. Deep amber urine, edges turning purple-red on standing. PBG dipstick glows. Tube: Porphobilinogen, Urine. Label: Urine PBG During Acute Attack · Turns Purple = Porphyria.

Panel 4: Five organ systems overlaid on body: gut red for visceral pain, brain with neural firing for seizure/psychosis, peripheral nerves frayed for paresthesias, heart tachy for autonomic storm, hypothalamus + ADH for SIADH/low Na. Label: AIP Pentad · One Disease Five Targets.

Panel 5: AIP vs PCT split. Left: urine PBG up arrow, clear skin, stool normal. Right: urine PBG normal, skin blisters on sun-exposed hands, uroporphyrin up. Label: PBG Distinguishes AIP From PCT · No Skin Findings In AIP.

Panel 6: Trigger cascade. Liver with ALCOHOL triggering P450 enzymes. P450 arrows to heme demand. ALA synthase amplifies. PBGD locked. ALA/PBG toxic waterfall. Label: Alcohol Induces P450 · ALA Synthase Unchecked.

Panel 7: Medication tray. IV hemin Panhematin 4mg/kg golden glow. D10W IV. Morphine syringe. Ondansetron. Levetiracetam. Label: Hemin Restores Feedback · Glucose Temporizes.

Panel 8: Physician with patient. Card: Avoid Alcohol, Sulfa, Barbiturates, Fasting. Medical Alert Bracelet visible. Warm light. Label: Lifelong Trigger Avoidance.

Panel 9: Patient walking out of hospital, daylight, medical alert bracelet visible, steady. Blue sky. Label: AIP · Diagnosed Treated Managed.

No cartoon, no flat design, photoreal cinematic."""

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
