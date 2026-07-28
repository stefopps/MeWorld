import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "Single cinematic still. Medical teaching image, Naughty Dog Uncharted 4 visual language: "
    "teal-blue-amber palette, cool overhead light, warm bedside accent, film grain, volumetric haze. "
    "A pregnant woman in hospital bed, BP cuff on arm showing 189/99, swollen hands and face. "
    "Five translucent glowing diagnostic panels float around her bed like holographic medical overlays: "
    "PANEL 1 labeled URINALYSIS showing a dipstick turning deep blue for protein. Proteinuria +3. "
    "PANEL 2 labeled 24-HOUR URINE PROTEIN showing a collection jug with 450 mg reading. "
    "PANEL 3 labeled TYPE & SCREEN showing blood type card reading O Positive, Rh positive. Antibody screen negative. "
    "PANEL 4 labeled PELVIC ULTRASOUND showing a grayscale fetal image with oligohydramnios. AFI 4.5 cm highlighted. "
    "PANEL 5 labeled PULSE OXIMETRY showing a finger probe reading SpO2 97 percent. "
    "Below the panels, an OB attending's hand pointing toward the urinalysis panel, "
    "as if teaching: THIS is what confirms the renal involvement. "
    "Blood sample tubes on bedside tray. Urine collection cup. Ultrasound probe nearby. "
    "The five panels are the core message: diagnostic orders that confirm what you already know and protect the score."
)

print(f"Prompt: {len(prompt)} chars", flush=True)
payload = {"prompt": prompt, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}
headers = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}

print("Submitting gaps...", flush=True)
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\pre-eclampsia-severe-2026-07-27\images\pre-eclampsia-severe-gaps.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
