import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT = r"C:\Users\steve\MeWorld\dev\screenshots\menopause-tia-estrogen-contraindication-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray dominant ambient lighting with warm amber focal accents. Heavy ambient occlusion. "
"Volumetric haze and atmospheric depth. Lived-in worn surfaces. Soft vignette at edges. "
"Warm/cool tension. Shadows have color temperature. One warm point light catching edges. "
"3x3 grid, 9 panels, landscape 16:9. NO TEXT ANYWHERE. "
"Panel 1: TSH blood tube dark and empty on counter, thyroid gland in shadow behind, dysfunction undiagnosed, hot flash symptom misattributed to menopause when it could be hyperthyroidism. "
"Panel 2: Urine pregnancy test stick unused on counter, beta-hCG vial empty, amenorrhea cause assumed but pregnancy never ruled out. "
"Panel 3: Prolactin blood tube empty, pituitary gland with microadenoma glowing hidden behind, prolactinoma causing amenorrhea and mimicking menopause, never screened. "
"Panel 4: Pap smear speculum on tray unused, cervical cells unsampled, infectious causes of dyspareunia undetected, wet mount slide empty. "
"Panel 5: Mammography machine dark and silent, breast tissue with occult malignancy hidden in shadows, systemic estrogen accidentally given to a cancer that feeds on it. "
"Panel 6: Vaginal estrogen cream tube unopened on counter, atrophic vaginal tissue still thin and pale, dyspareunia untreated, safe local therapy never given. "
"Panel 7: SSRI tablet bottle sealed, gabapentin capsule on counter untouched, hot flash thermostat in brain still on fire, systemic estrogen blocked by TIA but alternative never reached for. "
"Panel 8: Tdap vaccine card empty, no preventive care documented, patient leaving clinic with gaps in both treatment and prevention. "
"Panel 9: Correct path composite: TSH drawn glowing, pregnancy ruled out, prolactin normal, Pap done, mammogram clear, vaginal cream in hand, SSRI protecting brain thermostat, Tdap card stamped. All gaps closed. "
"Cinematic, high contrast, glossy detail, consistent style throughout, no text anywhere."
)

print(f"Gaps plate: {len(prompt)} chars", flush=True)
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
    print(f"FAILED: {sd}", flush=True)
