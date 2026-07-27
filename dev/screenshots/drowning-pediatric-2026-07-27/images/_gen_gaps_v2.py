import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT = r"C:\Users\steve\MeWorld\dev\screenshots\drowning-pediatric-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray ambient lighting. Heavy ambient occlusion. Volumetric haze and atmospheric depth. "
"Lived-in worn surfaces. Soft vignette at edges. Warm/cool tension. Shadows have color temperature. "
"3x2 grid, 6 panels, landscape 16:9. NO TEXT ANYWHERE. ED resuscitation bay environment. "
"Panel 1: Through Object In. Empty finger where pulse oximeter should clip. SpO2 waveform absent from monitor screen. Blank space where the oxygen number belongs. "
"Panel 2: Low angle macro. ABG collection tray empty, syringe untaken, wrist artery unaccessed. Vacant spot where pH and PaO2 values live. Data void. "
"Panel 3: Push in. Cardiac leads coiled on bedside table, unattached. Monitor screen blank, no rhythm wave, no heart rate displayed. The rhythm unseen. "
"Panel 4: Wide shot. Hands hovering above sternum but not compressing. A pause. The decision not yet made. Clock ticking. Perfusion absent. "
"Panel 5: Worm's-Eye View. Cold wet fabric still on body surface, no warming blanket deployed. Skin surface cold. Thermal bridge to hypothermia unbroken. "
"Panel 6: Dolly Zoom Out. Epinephrine ampoule sealed on metal tray, warm IV fluid bag unspiked, transfer order unsigned. The final interventions waiting. "
"Cinematic, high contrast, glossy detail, consistent style, no text anywhere."
)

print(f"Gaps v2: {len(prompt)} chars", flush=True)
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
elif s == "FAILED":
    print(f"FAILED", flush=True)
