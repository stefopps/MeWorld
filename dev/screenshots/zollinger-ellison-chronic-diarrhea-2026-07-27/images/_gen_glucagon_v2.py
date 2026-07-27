import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI macro render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray dominant ambient lighting with warm amber focal accents. Heavy ambient occlusion. "
"Volumetric haze and atmospheric depth. Lived-in worn surfaces with visible material detail. "
"Soft vignette at edges. Warm/cool tension. Shadows have color temperature, never pure black. "
"One warm point light catching edges. "
"3x3 grid, 9 panels, landscape 16:9. NO TEXT ANYWHERE. One continuous environment through the body, camera traveling. "

"Panel 1: Worm's-Eye View. Pancreatic tail, large tumor glowing amber, hormone molecules streaming into portal vein like thick golden smoke. "

"Panel 2: Bird's-Eye View. Liver acinus, hepatocytes grabbing amino acid building blocks from blood, converting them into glucose chains glowing warm orange. "

"Panel 3: Dolly Zoom In. Blood vessel, amino acid levels dropping, blood turning from rich amber to pale watery blue. Supply chain collapsing. "

"Panel 4: Crash Zoom In. Deep skin layer, keratinocyte cells with arms reaching up for amino acid supply, receiving nothing, hands grasping empty air, cells separating from neighbors. "

"Panel 5: Through Object In. Middle skin layer, desmosome bridges between keratinocytes snapping one by one, golden connections breaking into dust, epidermal layers peeling apart like dry paper sheets. "

"Panel 6: Low angle close-up. Skin surface, blister forming between separated layers, fluid pooling, the roof translucent and fragile, warm amber fluid beneath the surface. "

"Panel 7: Wide establishing shot. Lower abdominal skin surface, rash spreading in migratory pattern, edges vivid red with active peeling, center healing silver-pink, new lesion blooming adjacent. "

"Panel 8: Macrophotography extreme close-up. Intravenous amino acid infusion entering vein, glowing amber amino acid molecules flooding back into bloodstream, keratinocytes reconnecting desmosomes like hands clasping. Skin healing from within. "

"Panel 9: Push in. Patient in bed, surgical scar on abdomen healing, skin rash resolved, color returned to face. Tumor removed. Normoglycemic. Skin intact. No longer eating itself. "

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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\zollinger-ellison-chronic-diarrhea-2026-07-27\images\glucagonoma-nme-skin-cannibalism-3x3.png"
        with open(out,"wb") as f: f.write(r2.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
elif s == "FAILED":
    print(f"FAILED: {sd}", flush=True)
