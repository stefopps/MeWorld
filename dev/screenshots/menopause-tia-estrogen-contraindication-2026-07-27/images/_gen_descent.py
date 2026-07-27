import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT = r"C:\Users\steve\MeWorld\dev\screenshots\menopause-tia-estrogen-contraindication-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI macro render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray dominant ambient lighting with warm amber focal accents. Heavy ambient occlusion. "
"Volumetric haze and atmospheric depth. Lived-in worn surfaces with visible material detail. "
"Soft vignette at edges. Warm/cool tension. Shadows have color temperature, never pure black. "
"One warm point light catching edges. "
"3x3 grid, 9 panels, landscape 16:9. NO TEXT ANYWHERE. One continuous environment, camera traveling. "
"Panel 1: Worm's-Eye View. Brain blood vessel, clot passing through middle cerebral artery, tissue distal to occlusion dark and ischemic. TIA event visualized. Red warning glow around vessel. "
"Panel 2: Dolly Zoom In. Calendar flipping back one year, same brain vessel, tissue partially recovered but scarred, risk flame still burning, vessel wall weakened, never fully healed. "
"Panel 3: Crash Zoom In. Fork in hospital corridor. Left path systemic estrogen tablet glowing amber but blocked by massive red wall with thrombus symbols. Path impossible. Right path SSRI tablet and gabapentin capsule glowing green, path open. "
"Panel 4: Bird's-Eye View. Woman in bed, hot flash radiating from chest and face in visible orange heat waves, sweating, discomfort. Systemic estrogen blocked from reaching her. Red barrier between pill and patient. "
"Panel 5: Through Object In. Vaginal tissue surface, atrophic epithelium thin and pale, local estrogen cream applicator delivering medication directly to tissue, cells plumping and rehydrating, color returning. No systemic absorption. "
"Panel 6: Low angle close-up. Brain thermoregulatory center in hypothalamus, serotonin and norepinephrine molecules binding receptors, hot flash thermostat recalibrating, orange waves fading to calm blue. "
"Panel 7: Wide establishing shot. Two separate treatment lanes: upper lane vaginal cream targeting local tissue safe despite TIA. Lower lane SSRI and gabapentin targeting brain thermostat safe non-hormonal. Systemic estrogen lane closed forever, red cross over it. "
"Panel 8: Worm's-Eye View. Patient face calm, no sweating, skin normal color, hot flashes resolved, brain thermostat stable. Vaginal tissue plump and healthy below. Both symptoms managed through separate safe paths. "
"Panel 9: Push in. Patient walking outdoors, active, comfortable, sun on her face, no hot flashes, no dyspareunia, TIA history safely navigated. The forbidden path systemic estrogen sealed behind her, the correct paths ahead. "
"Cinematic, high contrast, glossy detail, consistent style throughout, no text anywhere."
)

print(f"TIA-estrogen plate: {len(prompt)} chars (limit 2995)", flush=True)
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
    print(f"FAILED: {sd}", flush=True)
