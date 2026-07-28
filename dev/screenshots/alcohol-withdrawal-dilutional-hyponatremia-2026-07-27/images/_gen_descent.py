import requests, time, os, base64
API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT_DIR = r"C:\Users\steve\MeWorld\dev\screenshots\alcohol-withdrawal-dilutional-hyponatremia-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
os.makedirs(OUT_DIR, exist_ok=True)
with open(ref_path,"rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = """Naughty Dog Uncharted 4 cinematic CGI. 3x3 grid, 9 panels. Cold clinical lighting in office setting, warm amber desk lamp, 35mm lens, film grain, desaturated medical color grade.

Panel 1: 52-year-old man sitting in clinic exam room, distended abdomen visible under shirt, hands trembling slightly, diaphoretic, anxious expression. Clock on wall shows 79 hours since last drink. Heart monitor shows 108 bpm. Label: 52M · Last Drink 3.3 Days Ago · Peak Withdrawal Window.

Panel 2: GABA/NMDA synapse diagram. Left: normal balance with GABA receptors sending blue inhibitory signals and NMDA receptors sending warm excitatory signals in equilibrium. Right: chronic alcohol brain showing atrophied GABA-A receptors and overgrown NMDA receptors with glutamate storm. Red lightning between neurons. Label: GABA Downregulated · NMDA Upregulated · Withdrawal = Unopposed Excitation.

Panel 3: CIWA-Ar scale on clipboard next to patient bed. Ten assessment items listed with scores. Total highlighted in amber at 15 — moderate to severe. Chlordiazepoxide vial and IV tubing beside it. Label: CIWA Score Guides Benzodiazepine Dosing.

Panel 4: Liver cross-section showing cirrhotic architecture — nodules surrounded by fibrous bands. Portal vein labeled with elevated pressure. Splachnic vasodilation diagram with dilated mesenteric vessels. Label: Alcoholic Cirrhosis · Portal Hypertension.

Panel 5: Dilutional hyponatremia mechanism. Kidney tubule with ADH binding to V2 receptor, aquaporin-2 channels inserting into membrane, water being reabsorbed. Beside it, serum sodium falling as water dilutes it. Ascites visible in peritoneal cavity. Label: Hypervolemic Hyponatremia · ADH Driven · Fluid Restrict Not Saline.

Panel 6: Timeline graphic showing alcohol withdrawal progression. 6 hrs tremor and anxiety. 12 hrs hallucinosis. 24 hrs seizure risk peak. 48 hrs DTs onset. Current time marker at 79 hours highlighted in red. Label: 72-96 Hours = DTs Danger Zone.

Panel 7: Three medication vials lined up on a tray in order: THIAMINE first with gold highlight, then CHLORDIAZEPOXIDE, then FOLATE and B12. A crossed-out glucose vial sits behind them. Label: Thiamine FIRST · Before Any Glucose · Prevent Wernicke Encephalopathy.

Panel 8: Physician speaking calmly to seated patient, hand on shoulder, warm ambient light. On wall behind, simple diagram: Stop Drinking > Benzodiazepines > Thiamine > Liver Monitoring > CIWA Protocol. Label: Treat Withdrawal · Treat The Liver · Treat The Addiction.

Panel 9: Wide shot of patient leaving clinic into evening light, prescription bag in hand, posture steadier than when he entered. Follow-up appointment card visible with date 2 weeks later. Label: Alcohol Withdrawal is Manageable · The Liver Needs Abstinence.

No cartoon, no flat design, photoreal Naughty Dog quality, volumetric lighting, cinematic."""

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
