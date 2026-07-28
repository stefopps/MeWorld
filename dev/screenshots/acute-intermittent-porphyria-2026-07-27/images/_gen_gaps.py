import requests, time, os, base64
API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT_DIR = r"C:\Users\steve\MeWorld\dev\screenshots\acute-intermittent-porphyria-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
os.makedirs(OUT_DIR, exist_ok=True)
with open(ref_path,"rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = """Naughty Dog Uncharted 4 cinematic CGI. 3x3 grid, 9 panels. Dark clinical lighting, film grain, desaturated blue-amber grade, 35mm.

Panel 1: Urine cup on lab counter with glowing red X. Urine deep amber, edges purple. Beside it, blood tube labeled PBG. Glowing green arrow pointing from blood to urine tube. Text: The One Test That Makes The Diagnosis. Label: Urine Porphobilinogen · Spot Urine During Attack.

Panel 2: Heme pathway diagram. Eight steps. Step 3 PBGD locked red. ALA and PBG accumulating. Arrow showing ALA causing neuronal damage: brain with seizure icon, nerves with tingling, gut with pain. Label: PBGD Blocked · ALA/PBG Neurotoxic · Five System Attack.

Panel 3: Physician on phone with hematologist, holding urine PBG result in one hand, phone in other. Hospital room behind with patient on bed. Label: Consult Heme/Onc · AIP Is 1 in 75000.

Panel 4: Alcohol bottle with bold red X overlaid on liver diagram. P450 enzymes glowing, arrow to ALA synthase amplification. Chain of events: Alcohol -> P450 -> Heme Demand -> ALA Synthase Unchecked -> Toxic Intermediates. Label: Alcohol Triggers AIP · Counsel Cessation.

Panel 5: IV bag labeled Normal Saline hanging on pole. Layered diagram behind: Na 131 on BMP, brain hypothalamus glowing, ADH molecule seeping, kidney tubule reabsorbing water. Label: Hyponatremia = SIADH · IV Fluids Needed.

Panel 6: All four missed orders side by side with red X becoming green check. Urine PBG tube with green check. Heme/Onc consult note with green check. Alcohol cessation card with green check. IV fluids bag with green check. Label: From Miss To Fix · Four Gaps Closed.

Panel 7: AIP vs PCT lab comparison chart. Left column AIP: PBG UP, ALA UP, no skin lesions. Right column PCT: PBG normal, uroporphyrin UP, skin blisters present. Stool porphyrins note: Normal in AIP, Elevated in PCT. Label: PBG Is The Differentiator · Stool Porphyrins Don't Help AIP.

Panel 8: Clock on wall showing time passing. Clock face split into four quadrants: late diagnosis (red), delayed treatment (orange), negative update (amber), correct treatment (green). Patient on bed transitioning from distress to calm. Label: Timing Matters · Every Hour Without Hemin = Nerve Damage Risk.

Panel 9: Physician at desk, teaching. Three key diagrams on wall: the heme pathway with PBGD highlighted, the AIP pentad of symptoms, the trigger avoidance list. Patient listening intently, steadier. Warm amber light. Label: Pattern Recognition Saves Lives · Abdominal Pain + Psych + Seizure = Think Porphyria.

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
