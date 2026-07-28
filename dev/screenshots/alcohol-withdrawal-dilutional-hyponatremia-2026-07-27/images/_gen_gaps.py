import requests, time, os, base64
API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT_DIR = r"C:\Users\steve\MeWorld\dev\screenshots\alcohol-withdrawal-dilutional-hyponatremia-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
os.makedirs(OUT_DIR, exist_ok=True)
with open(ref_path,"rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = """Naughty Dog Uncharted 4 cinematic CGI. 3x3 grid, 9 panels. Dark clinical lighting, film grain, cool blue-amber color grade, 35mm lens.

Panel 1: Mg blood tube on counter, physician hand pushes it aside to pick up IV MgSO4 bottle. Translucent heart behind showing prolonged QT. Label: Don't Order Magnesium · Give Empirically · QTc Protection.

Panel 2: T&S requisition with bold red X. Clean arm no bleeding. Three status icons: NO BLEEDING red, NO SURGERY red, Hgb 13 green. Label: Type and Screen Not Indicated.

Panel 3: Amylase tube with red X. Translucent normal pancreas behind, no edema, no fat stranding. Label: Amylase Not Indicated · No Epigastric Pain.

Panel 4: Osmolality tube labeled WRONG TIMING in red. BMP printout Na 132. Flowchart: check Na first, calculate osm, measure osm only if gap. Label: Osmolality Timing · Sodium First Then Gap.

Panel 5: All four wrong orders on tray, each with red X. Physician pushes tray aside. Clean plan underneath: chlordiazepoxide, thiamine, folate, CIWA, fluid restrict. Label: What Not to Order · Alcohol Withdrawal.

Panel 6: Kidney tubule with ADH binding V2 receptor, aquaporin-2 channels opening, water flowing. Falling sodium in blood. Ascites in peritoneal cavity. Label: Hypervolemic Hyponatremia · Water Excess Not Salt Deficit.

Panel 7: Split liver. Left normal, smooth dark red. Right cirrhotic nodules with white fibrous bands. Portal vein labeled. Label: Alcoholic Cirrhosis · Portal Hypertension Drives Ascites.

Panel 8: Wernicke triad: confused patient, unsteady ataxic walk, ophthalmoplegia eyes. Thiamine vial connects all three with golden lines. Label: Thiamine Prevents Wernicke · Confusion Ataxia Ophthalmoplegia.

Panel 9: Physician writing treatment plan on clipboard: Librium taper, Thiamine 500 IV, Folate 5mg, CIWA Q2H, Fluid restrict 1.5L. Patient watches with steadier hands, warm amber light. Label: Treat Withdrawal · Protect Brain · Heal Liver.

No cartoon, no flat design, photoreal cinematic."""

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
