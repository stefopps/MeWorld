import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "3x3 grid, UTI in pregnancy descent storyboard. Naughty Dog cinematic CGI, Uncharted 4 visual language: "
    "golden-hour volumetric light, teal-amber palette, soft film grain, shallow depth of field. "
    "PANEL 1: Pregnant woman in OB office, hand on lower abdomen. Expression of discomfort. "
    "Doctor taking history. Soft warm office lighting. "
    "PANEL 2: Close-up of urine sample being collected. Midstream clean-catch technique. "
    "Label on cup: UA + CULTURE. Clinical bathroom lighting. "
    "PANEL 3: Urinalysis dipstick showing positive leukocyte esterase and nitrites. "
    "Microscopy showing WBCs and bacteria. Lab bench with microscope. "
    "PANEL 4: Petri dish with E. coli colonies growing. Antibiotic sensitivity panel beside it. "
    "Rows showing: Ciprofloxacin SENSITIVE in green. Nitrofurantoin SENSITIVE in green. "
    "Ceftriaxone RESISTANT in red. "
    "PANEL 5: Molecular diagram. Fluoroquinolone molecule approaching fetal cartilage. "
    "Fetus silhouette in uterus. Red X overlay. Label: FLUOROQUINOLONE CROSSES PLACENTA = FETAL CARTILAGE DAMAGE. "
    "PANEL 6: Visual comparison. Left side: pregnancy-safe antibiotics in green (Nitrofurantoin, Cephalexin, Fosfomycin, Amoxicillin-Clav). "
    "Right side: contraindicated drugs in red crossed out (Ciprofloxacin, Levofloxacin, TMP-SMX). Split screen decision aid. "
    "PANEL 7: Nitrofurantoin capsule with calendar showing 5-day course. "
    "Fetal heart monitor showing reassuring tracing. Label: NITROFURANTOIN x 5 DAYS - SAFE IN 2nd TRIMESTER. "
    "PANEL 8: Doctor reassuring visibly anxious pregnant patient. Hand on shoulder. "
    "Prescription in hand. Fetal doppler showing strong heartbeat. Warm reassuring light. "
    "PANEL 9: Recovery. Follow-up visit. Woman smiling. Urine culture showing no growth. "
    "Baby bump larger (time passed). Healthy pregnancy continuing. Soft window light."
)

print(f"Prompt: {len(prompt)} chars", flush=True)
payload = {"prompt": prompt, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}
headers = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}

print("Submitting...", flush=True)
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\uti-pregnancy-2026-07-26\images\descent-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
