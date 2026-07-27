import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT = r"C:\Users\steve\MeWorld\dev\screenshots\drowning-pediatric-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray ambient lighting with warm amber accent on clinical equipment. Heavy ambient occlusion. "
"Volumetric haze and atmospheric depth. Lived-in worn surfaces. Soft vignette at edges. "
"Warm/cool tension. Shadows have color temperature. Subsurface scattering on skin. "
"3x2 grid, 6 panels, landscape 16:9. NO TEXT ANYWHERE. One continuous clinical story. "
"Panel 1: Through Object In. Child submerged in dark cold water, blue-gray murky depths. Laryngospasm visible as closed glottis, no water entering lungs yet. Oxygen molecules depleting, CO2 rising. Breath held. "
"Panel 2: Worm's-Eye View macro. Alveolar sacs filling with aspirated water, surfactant molecules washing away and scattering, alveolar walls collapsing inward, the lung stiffening and darkening from pink to gray. "
"Panel 3: Push in. Child's chest, ribcage translucent. Heart beating slow, weak, below 60 bpm. Oxygen-depleted blood pooling. Myocardium failing. Bradycardia visible as faint weak pulses. The pump dying from hypoxia. "
"Panel 4: Low angle. Kidney cross section, cold diuresis mechanism. ADH molecules suppressed, water molecules flooding out of collecting ducts. Blood volume shrinking. Hypovolemia despite drowning, cold body below. "
"Panel 5: Wide establishing shot. ED resuscitation bay. Child intubated, warming blanket covering body, warm IV fluids connected, epinephrine drawn into syringe. Cardiac monitor showing improving rhythm. Blue-gray cold lifting. "
"Panel 6: Dolly Zoom Out. Same ED bay, child's eyes opening, spontaneous limb movement visible. Monitor shows stable rhythm. Light warming the room. Transferred to ICU. Recovery beginning. "
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
elif s == "FAILED":
    print(f"FAILED", flush=True)
