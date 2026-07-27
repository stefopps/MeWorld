import requests, time, os, base64
API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT = r"C:\Users\steve\MeWorld\dev\screenshots\infective-endocarditis-ivdu-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path,"rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray ambient lighting with warm amber clinical accents. Heavy ambient occlusion. "
"Volumetric haze and atmospheric depth. Lived-in worn surfaces. Soft vignette. Warm/cool tension. "
"Subsurface scattering on tissue. "
"3x2 grid, 6 panels, landscape 16:9. NO TEXT ANYWHERE. One continuous clinical story. "
"Panel 1: Through Object In. Injection needle entering vein, talc and particulate matter visible in the injected material. Bacteria particles flowing with the injectate into venous circulation, traveling toward the heart. Skin flora entering the bloodstream. "
"Panel 2: Low angle macro. Mitral valve leaflet with endothelial damage site visible. Platelets and fibrin depositing on the rough surface, forming a sterile clot. Nonbacterial thrombotic endocarditis established. The landing pad created. "
"Panel 3: Worm's-Eye View. Bacteria adhering to the platelet-fibrin clot via surface adhesins. Bacteria multiplying and embedding into the vegetation. Biofilm layer forming. The fortress under construction. Immune cells unable to penetrate. "
"Panel 4: Push in. Vegetation fragment breaking off from the valve, embolizing through arterial circulation. Fragments traveling to skin producing Janeway lesions, to brain producing septic emboli, to spleen producing abscesses. The shower of emboli. "
"Panel 5: Wide establishing shot. Vancomycin molecule entering the vegetation, penetrating biofilm. Bacteria dying. Vegetation shrinking. Mitral valve leaflets stabilizing. Regurgitation decreasing. The correct antibiotic reaching the target. "
"Panel 6: Dolly Zoom Out. Hospital room. Patient recovering. ID team at bedside. Social worker present. Naloxone kit on bedside table. Substance abuse program pamphlet visible. Not just treating the valve — treating the human. Recovery from both disease and addiction. "
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
    urls = sd.get("generated",[]); url = urls[0] if isinstance(urls[0],str) else urls[0].get("url",""); r2 = requests.get(url, timeout=120)
    out = os.path.join(OUT, "descent-3x3.png")
    with open(out,"wb") as f: f.write(r2.content)
    print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
else: print(f"Status: {s}", flush=True)
