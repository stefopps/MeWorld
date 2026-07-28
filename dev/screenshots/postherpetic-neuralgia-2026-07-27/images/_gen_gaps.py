import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "Single cinematic medical teaching still, split-screen comparison. Naughty Dog Uncharted 4 visual language: "
    "teal-blue-amber palette, cool clinical light, warm focal accent, film grain, volumetric haze, "
    "shallow depth of field, heavy ambient occlusion. "
    "LEFT SIDE labeled CLASSICAL TRIGEMINAL NEURALGIA: Anatomical cutaway of trigeminal nerve root entry zone "
    "where a pulsating red superior cerebellar artery compresses the nerve. Focal demyelination visible as "
    "thinned pale myelin at contact point. Adjacent touch fiber and pain fiber with electrical arc (ephaptic cross-talk) "
    "jumping between them. Below: carbamazepine molecule diagram with sodium channel blockade annotation. "
    "Label: VASCULAR COMPRESSION leads to EPHAPTIC CROSS-TALK. TREATMENT: CARBAMAZEPINE. "
    "RIGHT SIDE labeled POSTHERPETIC TRIGEMINAL NEURALGIA: Cross-section of trigeminal ganglion with "
    "necrotic neurons, viral particles (VZV) in cell bodies. Large A-beta fibers destroyed and fragmented "
    "(deafferentation). Dorsal horn of spinal cord glowing with upregulated NMDA receptors (central sensitization). "
    "C-fiber nociceptive barrage flowing upward unimpeded past missing A-beta gate. "
    "Below: gabapentin molecule binding to alpha-2-delta subunit of presynaptic calcium channel, "
    "reducing glutamate release. Label: VIRAL DESTRUCTION leads to DEAFFERENTATION plus CENTRAL SENSITIZATION. "
    "TREATMENT: GABAPENTIN or PREGABALIN. "
    "CENTER DIVIDER: A glowing vertical line with text THE SAME NERVE. THE SAME PAIN. OPPOSITE TREATMENTS. "
    "Bottom banner: ASK ONE QUESTION - DID SHINGLES COME BEFORE THE PAIN? "
    "Warm amber light on text labels, cool blue clinical lighting on anatomical structures."
)

print(f"Prompt: {len(prompt)} chars", flush=True)
payload = {"prompt": prompt, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}
headers = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}

print("Submitting PHN vs TN comparison plate...", flush=True)
r = requests.post(ENDPOINT, json=payload, headers=headers, timeout=60)
td = (r.json().get("data") or r.json())
tid = td.get("task_id")
print(f"Task: {tid}", flush=True)

status = "pending"
while status.upper() not in ("COMPLETED","FAILED","CANCELLED"):
    time.sleep(10)
    pu = f"https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro/{tid}"
    sr = requests.get(pu, headers=headers, timeout=30)
    sd = (sr.json().get("data") or sr.json())
    status = str(sd.get("status","")).upper()
    print(f"  {status}", flush=True)

if status == "COMPLETED":
    urls = sd.get("generated",[])
    if urls:
        url = urls[0] if isinstance(urls[0],str) else urls[0].get("url","")
        img_r = requests.get(url, timeout=120)
        out = r"C:\Users\steve\MeWorld\dev\screenshots\postherpetic-neuralgia-2026-07-27\images\postherpetic-neuralgia-gaps.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
