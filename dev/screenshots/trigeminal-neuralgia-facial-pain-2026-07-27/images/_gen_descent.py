import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUT = r"C:\Users\steve\MeWorld\dev\screenshots\trigeminal-neuralgia-facial-pain-2026-07-27\images"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f: ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
"Naughty Dog cinematic CGI macro render, Uncharted 4 / The Last of Us visual style. Not a photograph. "
"Cool blue-gray dominant ambient lighting with warm amber focal accents. Heavy ambient occlusion. "
"Volumetric haze and atmospheric depth. Lived-in worn surfaces. Soft vignette at edges. "
"Warm/cool tension. Shadows have color temperature, never pure black. One warm point light catching edges. "
"3x3 grid, 9 panels, landscape 16:9. NO TEXT ANYWHERE. One continuous environment through the brainstem. "
"Panel 1: Worm's-Eye View. Trigeminal nerve exiting the pons, superior cerebellar artery looping over the nerve root entry zone, compression visible where vessel touches myelin. "
"Panel 2: Dolly Zoom In. Myelin sheath being stripped away at compression point, Schwann cell layers peeling back, bare axon exposed, yellow-white myelin fragments floating. "
"Panel 3: Crash Zoom In. Two demyelinated axons sitting adjacent, their bare membranes touching, electrical spark jumping from one axon to its neighbor across the contact point. Ephaptic cross-firing. "
"Panel 4: Through Object In. Touch receptor on left cheek being brushed by feather, signal traveling along V2 nerve, then jumping across to pain fiber at demyelinated segment, pain signal shooting to brain. "
"Panel 5: Bird's-Eye View. Face at macro scale, V2 and V3 territories glowing amber where pain is felt, V1 territory dark and silent, exact trigeminal distribution respected. "
"Panel 6: Macrophotography. Carbamazepine molecule binding to sodium channel, channel closing, action potential threshold rising, demyelinated axon now silent, spark failing to ignite. "
"Panel 7: Low angle. MRI scanner, T2-weighted image showing vascular loop compressing trigeminal nerve root, bright signal at compression point, no tumor, no MS plaque. Clean structural diagnosis. "
"Panel 8: Wide shot. Patient in clinic, taking carbamazepine tablet, face relaxed, pain-free expression, neural storm calmed, nerve diagram in background showing quiet axons. "
"Panel 9: Push in. Normal life, patient touching his face without flinching, sunlight on his skin, breeze on his cheek, no lightning, no fear. The trigger zones silent. "
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
