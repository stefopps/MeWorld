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
"Warm/cool tension. Shadows have color temperature, never pure black. One warm point light catching edges. "
"3x3 grid, 9 panels, landscape 16:9. NO TEXT ANYWHERE. One continuous body environment, camera traveling. "
"Panel 1: Worm's-Eye View. Descending colon, narrow lumen, polyp growing from mucosal surface like a dark mound, stool backing up behind it. "
"Panel 2: Dolly Zoom In. Polyp surface, adenoma cells multiplying, dysplasia deepening, crypt architecture becoming distorted, cells piling irregularly. "
"Panel 3: Crash Zoom In. Carcinoma cells breaking through basement membrane, invading submucosa, blood vessel nearby, tumor cells entering bloodstream. "
"Panel 4: Bird's-Eye View. Portal vein carrying tumor cells from colon toward liver, liver surface developing dark nodules, four metastatic lesions forming. "
"Panel 5: Through Object In. CT scanner ring around patient abdomen, cross-sectional image showing colonic mass with apple-core narrowing, contrast enhancing the lesion. "
"Panel 6: Low angle. Endoscope tip approaching colonic mass, biopsy forceps grasping tissue sample, golden biopsy fragment being pulled away for pathology. "
"Panel 7: Macrophotography. Blood tube on steel tray, CEA molecules glowing amber in serum, lab analyzer reading climbing, warm light on the glass meniscus. "
"Panel 8: Wide shot. Operating room, surgical team around patient draped in blue, colon segment with mass being resected, specimen on tray, warm overhead surgical light. "
"Panel 9: Push in. Follow-up clinic, patient recovering, CEA chart on wall showing downward trend, colonoscopy scope clean on counter, stool guaiac card negative, sunrise through window. "
"Cinematic, high contrast, glossy detail, consistent style throughout, no text anywhere."
)

print(f"Descent: {len(prompt)} chars", flush=True)
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
        out = os.path.join(OUT, "descent-3x3.png")
        with open(out,"wb") as f: f.write(r2.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
