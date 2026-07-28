import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "3x3 grid, pre-eclampsia clinical arc storyboard. Naughty Dog cinematic CGI, Uncharted 4 visual language: "
    "teal-blue-amber palette, cool clinical overhead light, warm bedside accent, soft film grain, volumetric haze, "
    "shallow depth of field, heavy ambient occlusion. No character on scene, only story beats. "
    "PANEL 1: Placental cross-section. Cytotrophoblast failing to invade spiral arteries. Narrow high-resistance vessels. "
    "Dark burgundy placental tissue. Scientific rendering. "
    "PANEL 2: Ischemic placenta releasing sFlt-1 and soluble endoglin into maternal bloodstream. "
    "Molecular cascade visual. Anti-angiogenic factors in red. "
    "PANEL 3: Pregnant woman's hands resting on swollen belly. BP cuff on arm reading 189/99. "
    "Facial edema visible in window reflection. Cool ED bay ambient. "
    "PANEL 4: Microscopic glomerulus. Endotheliosis - swollen endothelial cells narrowing capillary lumens. "
    "Protein molecules escaping into tubular space. Pink H&E stain. "
    "PANEL 5: IV pole with magnesium sulfate bag, labetalol vial on tray, betamethasone syringe. "
    "Medication labels readable. Soft hospital light. "
    "PANEL 6: Fetal monitor strip showing reassuring tracing. Ultrasound probe on belly with oligohydramnios visible on screen. "
    "PANEL 7: OB attending at bedside. Warm amber light. Cervical exam diagram on wall. Delivery plan discussion. "
    "PANEL 8: Delivery room. Neonatal warmer glowing. Baby being lifted. Cord unclamped. "
    "Mother's hand reaching. Teal surgical drapes. "
    "PANEL 9: Postpartum. Mother holding wrapped newborn. BP monitor showing normalized reading 120/72. "
    "Edema resolved. Window light soft dawn. Resolution."
)

print(f"Prompt: {len(prompt)} chars", flush=True)
payload = {"prompt": prompt, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}
headers = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}

print("Submitting descent...", flush=True)
r = requests.post(ENDPOINT, json=payload, headers=headers, timeout=60)
td = (r.json().get("data") or r.json())
tid = td.get("task_id")
print(f"Task: {tid}", flush=True)

status = "pending"
while status.upper() not in ("COMPLETED","FAILED","CANCELLED"):
    time.sleep(10)
    pu = f"https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro/{tid}"
    sr = requests.get(pu, headers=headers, timeout=30)
    sd = (sr.json().get("data") or sr.json())
    status = str(sd.get("status","")).upper()
    print(f"  {status}", flush=True)

if status == "COMPLETED":
    urls = sd.get("generated",[])
    if urls:
        url = urls[0] if isinstance(urls[0],str) else urls[0].get("url","")
        img_r = requests.get(url, timeout=120)
        out = r"C:\Users\steve\MeWorld\dev\screenshots\pre-eclampsia-severe-2026-07-27\images\pre-eclampsia-severe-descent-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
