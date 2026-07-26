import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = """3x3 grid, Graves hyperthyroidism descent. Naughty Dog cinematic CGI, Uncharted 4 visual language: golden-hour volumetric light, teal-amber palette, soft film grain, shallow depth of field.

PANEL 1: Young woman sitting on edge of bed at night, hand on chest, eyes wide. Sweating visible on brow. Anxiety and palpitations. Dim warm bedside lamp.

PANEL 2: ED triage. Same woman on stretcher, fine tremor visible in outstretched hands. Nurse checking pulse, concerned expression. Clinical overhead light.

PANEL 3: Close-up of neck examination. Physician's hands palpating visibly enlarged thyroid. Skin stretched over goiter. Mild exophthalmos visible in patient's face.

PANEL 4: Molecular close-up. TSH receptor on thyroid follicular cell. TSI autoantibody (Y-shaped) binding receptor. Glowing cascade inside cell: cAMP → T3/T4 synthesis. Label: "TSH RECEPTOR AUTOANTIBODY."

PANEL 5: Cardiac close-up. Transparent chest showing heart. T3 molecules entering cardiomyocytes through MCT8 channels. Nuclear receptor activation. Beta-1 receptors upregulating on membrane. Label: "T3 → BETA-1 UPREGULATION."

PANEL 6: ECG monitor showing sinus tachycardia at 120 bpm. Propranolol IV bag connected. Heart rate slowing to 80. Tremor diminishing in hands. Monitor shows rate decrease.

PANEL 7: Two medication vials: Methimazole and PTU. Split screen showing decision fork. Left: non-pregnant → Methimazole checkmark. Right: first trimester → PTU checkmark. Pregnancy test stick visible.

PANEL 8: Endocrinology consult. Attending physician showing thyroid ultrasound to patient. Normalized vital signs on monitor. Calendar showing 2 weeks of treatment.

PANEL 9: Recovery. Woman walking out of clinic, calm expression. No tremor. No exophthalmos visible. Thyroid size reduced. Sunlight. Discharge instructions in hand."""

print(f"Prompt: {len(prompt)} chars", flush=True)

payload = {"prompt": prompt, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}
headers = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}

print("Submitting...", flush=True)
r = requests.post(ENDPOINT, json=payload, headers=headers, timeout=60)
data = r.json()
td = data.get("data") or data
tid = td.get("task_id")
tpath = td.get("task_path", "")
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\graves-hyperthyroidism-2026-07-26\images\descent-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
