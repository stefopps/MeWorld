import base64, time, os, requests
API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "Single cinematic medical teaching still, 13 error panels. Naughty Dog Uncharted 4 visual language: "
    "teal-blue-amber palette, film grain, volumetric haze. "

    "CENTER: Elderly woman in clinic, right hand on temple, right eye dimmed. "
    "Only 7 orders placed. Score 35.69 percent. "
    "13 FLOATING PANELS radiating around her: "

    "DIAGNOSTIC MISSES (red x): "
    "1. ESR over 100. Label: ESR. Most sensitive. Normal rules out GCA. "
    "2. CRP elevated. Label: CRP. Pair with ESR. Rises and falls faster. "
    "3. Temporal artery biopsy surgical field. Label: TEMPORAL ARTERY BIOPSY. Gold standard. 3-5 cm segment. "
    "4. TSH tube. Label: TSH. Hyperthyroidism complicates any scenario. "
    "5. CTA thorax showing aneurysm. Label: CHEST IMAGING. 17x aortic aneurysm risk in GCA. "

    "TREATMENT MISSES (amber x): "
    "6. PREDNISONE 60mg highlighted, DEXAMETHASONE crossed out red. "
    "Label: PREDNISONE. Not dexamethasone. Flexible taper. Visual symptoms: IV methylprednisolone first. "
    "7. Vitamin D plus calcium. Osteoporotic bone scan. "
    "Label: VITAMIN D plus CALCIUM. Steroid bone prophylaxis from day one. "
    "8. Ophthalmologist at slit lamp. Label: OPHTHALMOLOGY CONSULT. Monitor vision threatened by GCA. "
    "9. Rheumatologist with taper schedule. Label: RHEUMATOLOGY CONSULT. Manage months of prednisone taper. "

    "PREVENTIVE MISSES (teal x): "
    "10. Tdap syringe. Label: TDAP. Every 10 years. "
    "11. Shingrix vial. Label: SHINGRIX. Recombinant zoster. All adults over 50. "
    "12. Hand on shoulder. Label: REASSURE PATIENT. She is losing vision and terrified. "
    "13. Medication calendar with compliance check. Label: MEDICATION COMPLIANCE. Prednisone for a year. Missed doses equals blindness. "

    "TOP TITLE: 35.69 PERCENT. SEVEN ORDERS PLACED. FORTY-ONE NEEDED. "
    "BOTTOM BANNER: GIANT CELL ARTERITIS. Steroids save the eye. Biopsy confirms. "
    "Prophylaxis protects the bones. Every case demands more than the diagnosis."
)

print(f"Prompt: {len(prompt)} chars", flush=True)
payload = {"prompt": prompt, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}
headers = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}
print("Submitting gaps...", flush=True)
r = requests.post(ENDPOINT, json=payload, headers=headers, timeout=60)
td = (r.json().get("data") or r.json())
tid = td.get("task_id")
print(f"Task: {tid}", flush=True)
status = "pending"
while status.upper() not in ("COMPLETED","FAILED","CANCELLED"):
    time.sleep(10)
    pu = f"{ENDPOINT}/{tid}"
    sr = requests.get(pu, headers=headers, timeout=30)
    sd = (sr.json().get("data") or sr.json())
    status = str(sd.get("status","")).upper()
    print(f"  {status}", flush=True)
if status == "COMPLETED":
    urls = sd.get("generated",[])
    if urls:
        url = urls[0] if isinstance(urls[0],str) else urls[0].get("url","")
        img_r = requests.get(url, timeout=120)
        out = r"C:\Users\steve\MeWorld\dev\screenshots\temporal-arteritis-2026-07-27\images\temporal-arteritis-gaps.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
