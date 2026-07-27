import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT = r"C:\Users\steve\MeWorld\dev\screenshots\zollinger-ellison-chronic-diarrhea-2026-07-27\images"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI macro render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray dominant ambient lighting with warm amber focal accents. Heavy ambient occlusion. "
"Volumetric haze and atmospheric depth. Lived-in worn surfaces with visible material detail. "
"Soft vignette at edges. Warm/cool tension. One warm point light catching edges. "
"3x3 grid, 9 panels, landscape 16:9. NO TEXT ANYWHERE. One continuous environment. "
"Story: Gastrinoma autonomously secretes gastrin causing massive acid hypersecretion, "
"dual-diarrhea mechanism through secretory and malabsorptive pathways, PPI blocks proton pump, surgical cure. "
"PANEL 1: Healthy man at home, kitchen, morning light, peaceful. "
"PANEL 2: Microscopic view, duodenal wall, small tumor nodule forming, pinkish mass, blood vessels around it. "
"PANEL 3: Parietal cell close-up, gastrin molecules binding receptors, proton pumps activating, acid vesicles fusing. "
"PANEL 4: Duodenal lumen flooded with golden-yellow acid, sodium absorption failing, water pooling in lumen. "
"PANEL 5: Fat droplets undigested, bile salt crystals precipitated, lipase molecules denatured in acid environment. "
"PANEL 6: Blood vial labeled, gastrin level display glowing 1200, endoscope view showing duodenal nodule. "
"PANEL 7: Proton pump blocked by PPI molecule, acid production stopped, parietal cell at rest, gradient color green. "
"PANEL 8: Operating room, surgical instruments, duodenal nodule being resected, blue sterile field, warm key light. "
"PANEL 9: Recovered patient outdoors, healthy skin, holding lab panel with PTH Ca prolactin results, no smoking. "
"Cinematic, high contrast, glossy detail, consistent style, no text anywhere."
)

print(f"Descent prompt: {len(prompt)} chars (limit 2995)", flush=True)

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
        out = os.path.join(OUT, "descent-3x3.png")
        with open(out,"wb") as f: f.write(r2.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB to descent-3x3.png", flush=True)
elif s == "FAILED":
    print(f"FAILED response: {sd}", flush=True)
