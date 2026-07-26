import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "3x3 grid, chlamydia urethritis medical storyboard. Naughty Dog cinematic CGI, Uncharted 4 visual language: "
    "golden-hour volumetric light, teal-amber palette, soft film grain, shallow depth of field. "
    "PANEL 1: Young man in clinic waiting room, hand near lower abdomen, expression of discomfort. "
    "PANEL 2: Doctor in exam room taking history. Patient describing urinary symptoms. "
    "PANEL 3: Physical exam showing urethral discharge on gloved hand. Clinical lighting. "
    "PANEL 4: Urine sample being collected. First-catch cup. NAAT test label visible. "
    "PANEL 5: Microscopic cellular view. Chlamydia inclusion bodies inside epithelial cell. "
    "Elementary bodies visible. Scientific rendering. "
    "PANEL 6: Azithromycin capsules on counter. Cefixime bottle beside. Single dose package. "
    "PANEL 7: Doctor counseling patient. Safe sex brochure on desk. Partner notification form. "
    "PANEL 8: Calendar showing 7 days. Patient recovering at home. "
    "PANEL 9: Recovery. Patient outdoors with friends. Healthy, symptom-free. Resolution."
)

print(f"Prompt: {len(prompt)} chars", flush=True)
payload = {"prompt": prompt, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}
headers = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}

print("Submitting...", flush=True)
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\chlamydia-urethritis-2026-07-26\images\descent-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
