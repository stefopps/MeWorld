import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT = r"C:\Users\steve\MeWorld\dev\screenshots\colon-cancer-constipation-2026-07-27\images"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray dominant ambient lighting with warm amber focal accents. Heavy ambient occlusion. "
"Volumetric haze and atmospheric depth. Lived-in worn surfaces. Soft vignette at edges. "
"Warm/cool tension. Shadows have color temperature. One warm point light catching edges. "
"3x3 grid, 9 panels, landscape 16:9. NO TEXT ANYWHERE. "
"Panel 1: Colonoscopy scope unused on tray, dark and cold, colonic mass in darkness behind, unanswered. "
"Panel 2: Blood tube empty on counter, CEA label visible, no blood drawn, tumor marker never checked. "
"Panel 3: ECG leads coiled on bedside table, monitor off, no rhythm strip, 71-year-old heart unassessed before surgery. "
"Panel 4: PT/PTT vials empty, type and screen blood bag still wrapped in plastic, no pre-op labs drawn. "
"Panel 5: NPO sign on door ignored, water glass on bedside table, stomach full before abdominal surgery. "
"Panel 6: Surgical consult referral form blank on desk, phone off hook, operating room dark, no surgery scheduled, tumor still growing. "
"Panel 7: Patient sitting alone in clinic chair, doctor walking away, diagnosis given but no counseling, no support, no next steps. "
"Panel 8: Composite: all seven missed items converging into dark colonic mass, still staged but untreated, CEA rising, liver mets expanding. "
"Panel 9: Correct path contrast: same patient in OR, colonoscopy complete, CEA drawn, ECG monitoring, pre-op labs running, surgery happening, mass being removed. "
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
