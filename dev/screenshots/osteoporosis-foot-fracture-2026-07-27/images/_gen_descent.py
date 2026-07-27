import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT = r"C:\Users\steve\MeWorld\dev\screenshots\osteoporosis-foot-fracture-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray ambient lighting with warm amber clinical accents. Heavy ambient occlusion. "
"Volumetric haze. Lived-in worn surfaces. Soft vignette. Warm/cool tension. "
"Subsurface scattering on skin and bone tissue. "
"3x2 grid, 6 panels, landscape 16:9. NO TEXT ANYWHERE. One continuous clinical story. "
"Panel 1: Through Object In. Postmenopausal woman's foot, translucent skin showing metatarsal bones with hairline fracture. Trabecular bone structure visibly porous, thinned, honeycomb pattern eroded. Osteoclast cells active on bone surface. Estrogen molecule levels fallen far below. "
"Panel 2: Low angle macro. Vertebral body cross section. Trabecular struts thinning and disconnecting. Osteoclast giant cells resorbing bone matrix. RANKL molecules flooding the surface. OPG molecules absent. The architecture collapsing from inside. "
"Panel 3: Worm's-Eye View. Intestinal villi lacking vitamin D. Calcium molecules barely crossing the intestinal epithelium into bloodstream. Parathyroid glands enlarged, PTH molecules streaming to bone surface. The secondary hyperparathyroidism cascade. "
"Panel 4: Push in. DEXA scanner beam passing through lumbar spine and hip. BMD numbers visibly low. T-score indicator in red zone below minus 2.5. The machine quantifying the invisible bone loss. "
"Panel 5: Wide establishing shot. Clinical office. Vitamin D supplement bottle on table. Alendronate 70 mg weekly tablet beside it. Bisphosphonate molecule docking onto osteoclast, the cell dying, bone resorption stopping. Bone surface stabilizing. "
"Panel 6: Dolly Zoom Out. Same woman on a walking path, upright, confident stride. Bones dense and healthy in ghost overlay. Hip intact. Spine straight. Sunlight on skin producing vitamin D. The fracture that never happened. "
"Cinematic, high contrast, glossy detail, consistent style, no text anywhere."
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
else: print(f"Status: {s}", flush=True)
