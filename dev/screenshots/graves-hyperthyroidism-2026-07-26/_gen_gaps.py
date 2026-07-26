import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "3x3 grid, Graves disease missed interventions teaching plate. "
    "Naughty Dog cinematic CGI, Uncharted 4 visual language: golden-hour volumetric light, teal-amber palette, soft film grain, shallow depth of field. "
    "PANEL 1: Pregnancy test stick showing positive result. Fetus icon in background. Label: hCG BEFORE METHIMAZOLE - FIRST TRIMESTER TERATOGENICITY. "
    "PANEL 2: Cardiac ECG strip showing atrial fibrillation. Heart diagram with T3-labeled arrows entering myocytes. Label: ECG - THYROID DRIVES AFIB - T3 SHORTENS ATRIAL REFRACTORY PERIOD. "
    "PANEL 3: Urine toxicology cup with positive cocaine and amphetamine bars. Patient with anxiety expression, sweating. Label: TOX SCREEN - STIMULANT TOXIDROME UNTIL RULED OUT. "
    "PANEL 4: Blood draw with CBC tube. Neutrophil count visible dropping. Label: CBC - BASELINE BEFORE METHIMAZOLE - AGRANULOCYTOSIS RISK. "
    "PANEL 5: Liver diagram with PTU molecule near hepatocytes. LFT panel showing elevated AST/ALT. Label: CMP LFTs - PTU BLACK BOX - FULMINANT HEPATIC NECROSIS. "
    "PANEL 6: Thyroid follicular cell cross-section. TPO enzyme blocked by methimazole molecule with red X. Iodide unable to bind thyroglobulin. Label: METHIMAZOLE BLOCKS TPO - NO NEW T4 T3 SYNTHESIS. "
    "PANEL 7: Two-column decision tree. Left side: NOT PREGNANT then METHIMAZOLE in gold. Right side: FIRST TRIMESTER then PTU in orange. Fetal icon with methimazole crossed out. Label: PREGNANCY STATUS DETERMINES DRUG CHOICE. "
    "PANEL 8: Endocrinology attending at bedside with thyroid ultrasound probe. Treatment plan on clipboard showing Methimazole 20mg daily with Propranolol 40mg TID and CBC weekly monitoring. Label: CONSULT ENDOCRINE - TITRATION PLANNING. "
    "PANEL 9: Patient timeline calendar: Week 1 shows propranolol and methimazole. Week 4 shows normalizing TSH. Month 6 shows euthyroid state. Label: THE ARC - SYMPTOMS TO EUTHYROID TO MAINTENANCE."
)

print(f"Prompt: {len(prompt)} chars", flush=True)

payload = {"prompt": prompt, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}
headers = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}

print("Submitting...", flush=True)
r = requests.post(ENDPOINT, json=payload, headers=headers, timeout=60)
data = r.json()
td = data.get("data") or data
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\graves-hyperthyroidism-2026-07-26\images\descent-gaps-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
