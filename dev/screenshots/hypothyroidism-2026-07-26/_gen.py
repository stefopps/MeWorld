import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

p = ("3x3 grid, hypothyroidism storyboard. Naughty Dog cinematic CGI, Uncharted 4 visual language. "
"PANEL 1: Obese woman in clinic, tired, hands on lap. PANEL 2: Doctor checking thyroid. "
"PANEL 3: Blood draw TSH T4 tubes. PANEL 4: Lab report high TSH low T4. "
"PANEL 5: Thyroid gland failing, T4 production decreased. PANEL 6: Levothyroxine tablet, calendar 6 weeks. "
"PANEL 7: Heart monitor before bradycardia after normal. PANEL 8: Follow-up woman alert, labs improving. "
"PANEL 9: Recovery woman walking outdoors active healthy.")

print(f"Prompt: {len(p)} chars", flush=True)
b = {"prompt": p, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}
h = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}

r = requests.post(ENDPOINT, json=b, headers=h, timeout=60)
d = (r.json().get("data") or r.json())
tid = d.get("task_id")
print(f"Task: {tid}", flush=True)

s = "pending"
while s.upper() not in ("COMPLETED","FAILED","CANCELLED"):
    time.sleep(10)
    sr = requests.get(f"https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro/{tid}", headers=h, timeout=30)
    sd = (sr.json().get("data") or sr.json())
    s = str(sd.get("status","")).upper()
    print(f"  {s}", flush=True)

if s == "COMPLETED":
    urls = sd.get("generated",[])
    if urls:
        url = urls[0] if isinstance(urls[0],str) else urls[0].get("url","")
        r2 = requests.get(url, timeout=120)
        out = r"C:\Users\steve\MeWorld\dev\screenshots\hypothyroidism-2026-07-26\images\descent-3x3.png"
        with open(out,"wb") as f: f.write(r2.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
