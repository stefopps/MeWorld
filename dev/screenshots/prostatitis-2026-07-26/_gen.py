import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

p = ("3x3 grid, prostatitis workup storyboard. Naughty Dog cinematic CGI, Uncharted 4 visual language. "
"PANEL 1: Young man feverish in clinic. PANEL 2: Rectal exam, tender prostate on diagram. "
"PANEL 3: Urine gram stain showing gram-negative rods. PANEL 4: Chlamydia gonorrhea NAAT test panel. "
"PANEL 5: Fluoroquinolone penetrating prostate tissue, beta-lactams blocked. "
"PANEL 6: Ciprofloxacin tablet, 14 day course calendar. PANEL 7: Nitrofurantoin crossed out, bladder only diagram. "
"PANEL 8: Preventive counseling seat belt condom meningococcal. PANEL 9: Recovery back to college healthy.")

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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\prostatitis-2026-07-26\images\descent-3x3.png"
        with open(out,"wb") as f: f.write(r2.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
