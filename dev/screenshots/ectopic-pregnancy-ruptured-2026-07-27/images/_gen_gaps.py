import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "Single cinematic medical teaching still. Naughty Dog Uncharted 4 visual language: "
    "teal-blue-amber palette, cool overhead clinical light, warm bedside accent, film grain, volumetric haze. "
    "A young woman in ED bed, clutching lower abdomen in pain. IV pole beside her with empty bag space. "
    "Six translucent glowing holographic panels float around her bed showing the MISSED orders: "
    "PANEL 1 labeled BETA hCG showing a positive pregnancy test stick with two lines. "
    "PANEL 2 labeled IV FLUIDS showing a bag of normal saline with drops falling. The patient needs volume. "
    "PANEL 3 labeled ANALGESIA showing a morphine vial and syringe. She is in severe pain. "
    "PANEL 4 labeled ANTIEMETIC showing ondansetron dissolving on tongue. She is nauseated. "
    "PANEL 5 labeled PRE-OP EKG showing a 12-lead ECG strip with normal sinus rhythm. Surgery checklist. "
    "PANEL 6 labeled SMOKING CESSATION showing a cigarette being extinguished. Counseling. "
    "An attending physician's hand pointing toward the IVF panel, teaching: "
    "She is bleeding internally. Volume first. Pain control parallel. Then find the surgeon. "
    "Bottom banner: STABILIZE BEFORE YOU DIAGNOSE. COMFORT BEFORE YOU OPERATE. COUNSEL AT THE END."
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\ectopic-pregnancy-ruptured-2026-07-27\images\ectopic-pregnancy-ruptured-gaps.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
