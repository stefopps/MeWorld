import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT = r"C:\Users\steve\MeWorld\dev\screenshots\drowning-pediatric-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray ambient lighting with warm amber accent on medical details. Heavy ambient occlusion. "
"Volumetric haze and atmospheric depth. Lived-in worn surfaces. Soft vignette at edges. "
"Warm/cool tension. Shadows have color temperature. Subsurface scattering on skin. "
"3x2 grid, 6 panels, landscape 16:9. NO TEXT ANYWHERE. One continuous clinical environment. "
"Panel 1: Through Object In. Pulse oximeter probe absent from child's finger, oxygen saturation reading missing, monitor showing no SpO2 waveform. The gap: hypoxia unmonitored. "
"Panel 2: Low angle macro. Arterial blood gas syringe absent from wrist, empty vacutainer where ABG should be drawn. Dissolved oxygen and pH unmeasured. The gap: oxygen and acid-base status unknown. "
"Panel 3: Push in. Cardiac monitor leads hanging loose, not attached to the child's chest. Blank monitor screen with no rhythm tracing. The gap: bradycardia unwatched. "
"Panel 4: Wide shot. Resuscitation team standing idle, no chest compressions happening on the child. Hands away from sternum. PALS guideline visible: HR less than 60 with poor perfusion equals CPR. The gap: compressions not started. "
"Panel 5: Worm's-Eye View. Cold wet clothing still on the child, no warming blanket applied. Skin blue and cold. The gap: hypothermia perpetuated by retained wet fabric conductively cooling the body into deeper bradycardia. "
"Panel 6: Dolly Zoom Out. Epinephrine vial untouched on tray, warm IV fluids not connected, ICU transfer sign unseen. The gap: the cardiac pump never got the drug it needed. Child remains in ED, not ICU. "
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
elif s == "FAILED":
    print(f"FAILED", flush=True)
