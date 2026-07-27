import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray dominant ambient lighting with warm amber focal accents only. Heavy ambient occlusion in deep shadows. "
"Volumetric haze and atmospheric depth. Nothing razor-sharp at distance. Lived-in worn surfaces with visible material wear. "
"Chipped paint, wood grain, weathered metal. Soft vignette at edges. Environmental storytelling composition. "
"Every surface feels handled. Warm/cool tension throughout. Shadows have color temperature, never pure black. "
"One warm point light catching edges. Subsurface scattering on skin. "
"3x3 grid, 9 panels, landscape 16:9. NO TEXT ANYWHERE, no words, letters, numbers, labels. "
"One continuous hospital environment across all panels, camera traveling through it, no two adjacent panels sharing an angle. "
"Panel 1: Worm's-Eye View. Duodenal wall, tiny tumor nodule glowing amber, gastrin streaming into portal blood, parietal cells below lighting up acid production. "
"Panel 2: Bird's-Eye View. Fork in road. Left path leads to ONE tumor solitary. Right path FOUR tumors scattered in duodenal wall all glowing. The fork sign. Decision point. "
"Panel 3: Dolly Zoom In. Three glowing organs in surgical shadow: parathyroid gland warm orange, pituitary gland soft pink, pancreas deep amber. MEN1 triad all lit. "
"Panel 4: Crash Zoom In. Three blood tubes on steel tray, warm key light catching glass. One orange, one white-blue, one soft pink. Focus on glass meniscus. "
"Panel 5: Through Object In. Surgeon's gloved hand holding scalpel removing one duodenal tumor. Behind it three more tumors still glowing still secreting. Cure that fails. "
"Panel 6: Low angle. Patient bare chest, ECG leads attached, heart rhythm strip glowing steady on bedside monitor. PT/PTT vials beside bed. Type and screen blood bag hanging. Pre-op baseline calm blue monitoring light. "
"Panel 7: Wide shot. Patient sitting alone in office chair, no IV, no monitor, no treatment. Gastrin lab tube empty dark on counter. PPI bottle unopened. Daylight passing. Time wasting. "
"Panel 8: Worm's-Eye View. Same patient in hospital bed, PPI IV bag dripping amber fluid, ECG trace glowing steady, surgical overhead light approaching warm and focused. Correct path. "
"Panel 9: Push in. Recovery room. Patient face calm, color returned. Lab chart on bedside table showing gastrin curve descending. One path: cured scar healing. Other path: PPI pill on nightstand lifelong management. Either way controlled. "
"Cinematic, high contrast, glossy detail, consistent style throughout, no text anywhere."
)

print(f"Prompt: {len(prompt)} chars (limit 2995)", flush=True)
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\zollinger-ellison-chronic-diarrhea-2026-07-27\images\men1-ecg-preop-3x3.png"
        with open(out,"wb") as f: f.write(r2.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
elif s == "FAILED":
    print(f"FAILED: {sd}", flush=True)
