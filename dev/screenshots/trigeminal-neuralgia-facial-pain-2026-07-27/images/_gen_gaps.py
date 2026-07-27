import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT = r"C:\Users\steve\MeWorld\dev\screenshots\trigeminal-neuralgia-facial-pain-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray dominant ambient lighting with warm amber focal accents. Heavy ambient occlusion. "
"Volumetric haze and atmospheric depth. Lived-in worn surfaces. Soft vignette at edges. "
"Warm/cool tension. Shadows have color temperature. One warm point light catching edges. "
"3x3 grid, 9 panels, landscape 16:9. NO TEXT ANYWHERE. "
"Panel 1: CBC vial empty on counter, no blood drawn, infection undetected, dental procedure site on jaw glowing red with hidden abscess. "
"Panel 2: CMP panel dark on monitor, sodium glass on bedside table empty, no baseline electrolytes, carbamazepine bottle on counter starting treatment blind. "
"Panel 3: MRI scanner dark and silent, trigeminal nerve compression by vascular loop invisible in darkness, tumor or MS plaque hidden, structural diagnosis missed. "
"Panel 4: Composite: three missed items converging, face still in pain, nerve compression untreated, infection untreated, diagnosis incomplete. "
"Panel 5: Correct path: CBC blood draw, tube glowing amber, infection ruled out, dental sites clean. "
"Panel 6: Correct path: CMP results glowing on monitor, sodium baseline 138, creatinine and LFTs normal, carbamazepine ready to start safely. "
"Panel 7: Correct path: MRI scanner active, T2 image showing vascular loop in crisp detail, no tumor, no plaque, structural diagnosis confirmed. "
"Panel 8: Correct path: Patient receiving carbamazepine, sodium levels monitored, nerve quiet, pain resolved. "
"Panel 9: Correct path: Patient outdoors, face relaxed, breeze touching skin without pain, full recovery, all three gaps closed. "
"Cinematic, high contrast, glossy detail, consistent style throughout, no text anywhere."
)

print(f"Gaps: {len(prompt)} chars", flush=True)
b = {"prompt": prompt, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}
h = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}
r = requests.post(ENDPOINT, json=b, headers=h, timeout=60)
d = (r.json().get("data") or r.json()); tid = d.get("task_id")
print(f"Task: {tid}", flush=True)
s = "pending"
while s.upper() not in ("COMPLETED","FAILED","CANCELLED"):
    time.sleep(10)
    sr = requests.get(f"https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro/{tid}", headers=h, timeout=30)
    sd = (sr.json().get("data") or sr.json()); s = str(sd.get("status","")).upper()
    print(f"  {s}", flush=True)
if s == "COMPLETED":
    urls = sd.get("generated",[])
    if urls:
        url = urls[0] if isinstance(urls[0],str) else urls[0].get("url","")
        r2 = requests.get(url, timeout=120)
        out = os.path.join(OUT, "descent-gaps-3x3.png")
        with open(out,"wb") as f: f.write(r2.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
