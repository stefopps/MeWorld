import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT = r"C:\Users\steve\MeWorld\dev\screenshots\osteoporosis-foot-fracture-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray ambient lighting. Heavy ambient occlusion. Volumetric haze. Lived-in worn surfaces. "
"Soft vignette. Warm/cool tension. "
"3x2 grid, 6 panels, landscape 16:9. NO TEXT ANYWHERE. Clinical office environment. "
"Panel 1: Through Object In. Ankle X-ray film illuminated on light box, showing clear talocrural joint, distal tibia and fibula, but the metatarsals are cut off at the bottom edge, invisible. The gap: wrong anatomy imaged. Foot pain but ankle shot. "
"Panel 2: Low angle macro. Foot X-ray film beside ankle film. Foot film showing hairline metatarsal fracture, clearly visible. Ankle film showing the fracture zone cropped out. The gap: the metatarsals invisible on ankle view. "
"Panel 3: Worm's-Eye View. Lumbar spine CT scan on monitor, normal findings, no compression, no nerve impingement. A clean study but looking at the wrong part of the problem. The gap: searching the spine when the disease is metabolic. "
"Panel 4: Push in. DEXA scanner sitting unused and dark in corner of office. T-score display blank. The gap: osteoporosis screening never ordered. A fracture from tripping should trigger bone density measurement. "
"Panel 5: Wide shot. Vitamin D 25-OH lab tube unfilled on tray, empty requisition. Bisphosphonate prescription pad blank. Exercise counseling pamphlet untouched. The gap: treatment never initiated. Zero treatment orders. "
"Panel 6: Dolly Zoom Out. Woman walking away from office, hip subtly translucent showing fragile trabecular structure. The next fracture hanging in the future, unseen. The gap: fragility fracture without metabolic workup means the hip fracture is coming. "
"Cinematic, high contrast, glossy detail, consistent style, no text anywhere."
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
else: print(f"Status: {s}", flush=True)
