import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT = r"C:\Users\steve\MeWorld\dev\screenshots\zollinger-ellison-chronic-diarrhea-2026-07-27\images"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI macro render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray dominant ambient lighting with warm amber focal accents. Heavy ambient occlusion. "
"Volumetric haze and atmospheric depth. Lived-in worn surfaces. Soft vignette at edges. "
"3x3 grid, 9 panels, landscape 16:9. NO TEXT ANYWHERE. "
"Story: ZES diagnosis missed. Serum gastrin not ordered. No endoscopy. No CT staging. "
"No PPI treatment. No surgical consult. No MEN1 screening. Kept in office. No smoking cessation counseling. "
"PANEL 1: Blood draw being skipped, gastrin tube empty on counter, calendar showing 3 years of missed diagnosis. "
"PANEL 2: Upper endoscope unused on tray, duodenal nodule invisible in shadows, opportunity missed. "
"PANEL 3: CT scanner dark empty room, gastrinoma tumor glowing hidden in duodenum, no imaging obtained. "
"PANEL 4: PPI pill bottle unopened on counter, proton pumps raging unchecked, acid flooding duodenum, orange-gold. "
"PANEL 5: Surgical tray unused, covered in dust, operating room dark, gastrinoma still growing, metastatic spread shadows. "
"PANEL 6: Empty lab tubes for PTH, ionized calcium, prolactin. MEN1 tumor silent behind. Parathyroid adenoma hidden. "
"PANEL 7: Office door instead of hospital admission. Patient walking away, suitcase still packed. Wrong location. "
"PANEL 8: Cigar still burning in ashtray, no counseling given, gastric ulcer forming behind, smoke curling ominous. "
"PANEL 9: Composite of all missed items converging into one patient, still symptomatic, still undiagnosed, still untreated. "
"Cinematic, high contrast, glossy detail, consistent style, no text anywhere."
)

print(f"Gaps prompt: {len(prompt)} chars (limit 2995)", flush=True)

b = {"prompt": prompt, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}
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
        out = os.path.join(OUT, "descent-gaps-3x3.png")
        with open(out,"wb") as f: f.write(r2.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB to descent-gaps-3x3.png", flush=True)
elif s == "FAILED":
    print(f"FAILED response: {sd}", flush=True)
