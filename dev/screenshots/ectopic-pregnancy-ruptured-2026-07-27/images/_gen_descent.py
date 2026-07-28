import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "3x3 grid, ruptured ectopic pregnancy clinical arc storyboard. Naughty Dog cinematic CGI, Uncharted 4 visual language: "
    "teal-blue-amber palette, cool clinical overhead light, warm bedside accent, film grain, volumetric haze. "
    "PANEL 1: Fallopian tube cross-section. Blastocyst implanting in thin tubal wall instead of endometrium. "
    "Trophoblast cells invading the muscular layer. No thick decidua to support it. "
    "PANEL 2: Young woman in ED bay clutching lower abdomen. Unilateral pain. Pale. Anxious expression. "
    "BP cuff showing borderline reading. IV not yet started. "
    "PANEL 3: Transvaginal ultrasound probe. Screen showing empty uterus with echogenic free fluid in pouch of Douglas. "
    "Adnexal mass visible. Label: NO IUP. FREE FLUID. "
    "PANEL 4: Internal view of ruptured tube. Arterial blood spilling into peritoneal cavity. "
    "Red blood cells pooling around bowel loops. The patient bleeds internally. "
    "PANEL 5: OR setup. Surgical drapes teal. Laparotomy tray with instruments. "
    "Anesthesia monitor showing vitals. Blood products hanging on IV pole. "
    "PANEL 6: Surgeon's hands tying off bleeding vessel in fallopian tube. "
    "Salpingectomy in progress. Hemostasis achieved. "
    "PANEL 7: Post-op recovery. Patient in hospital bed. IV fluids running. Monitor showing stable vitals. "
    "Pain controlled. Family at bedside. "
    "PANEL 8: Discharge counseling. Doctor discussing smoking cessation, safe sex, alcohol. "
    "Brochures on bedside table. Compassionate eye contact. "
    "PANEL 9: Follow-up clinic. Patient healthy. Repeat beta hCG trending to zero. Future fertility discussion. Resolution."
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\ectopic-pregnancy-ruptured-2026-07-27\images\ectopic-pregnancy-ruptured-descent-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
