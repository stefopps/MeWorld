import base64, time, os, requests

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "Single cinematic medical teaching still. Naughty Dog Uncharted 4 visual language: teal-blue-amber palette, "
    "cool clinical light, warm focal accent, film grain, volumetric haze, shallow depth of field. "

    "CENTER DOMINANT IMAGE: Woman sitting in clinic exam room, right hand on her painful knee. "
    "Knee X-ray on lightbox behind her showing joint space narrowing and osteophytes. "
    "Above her head: a warning sign reading SHE TOLD YOU NSAIDs MAKE HER SICK in amber glow. "

    "EMANATING FROM THE PATIENT, four error panels showing what went wrong: "

    "TOP LEFT (largest, red warning glow): Ketorolac injection vial with red X through it. "
    "Behind it: stomach cross-section showing active PUD ulcer with COX-1 enzyme blocked. "
    "Label: KETOROLAC. She has PUD. She told you. Tenfold GI bleed risk. DIRECT CONTRAINDICATION. "

    "TOP RIGHT: OR view showing total knee replacement in progress. Ladder graphic beside it showing "
    "you jumped from DIAGNOSIS straight to SURGERY with all conservative steps (weight loss, PT, duloxetine, "
    "steroid injection) greyed out and skipped. Label: TOTAL KNEE REPLACEMENT. Conservative ladder skipped. "
    "You went straight to the top rung. "

    "BOTTOM LEFT: Knee joint with needle inserted for arthrocentesis. X-ray beside it clearly showing OA. "
    "Label: ARTHROCENTESIS. X-ray already answered the question. Invasive. Not indicated for OA. "

    "BOTTOM RIGHT: Lab requisition forms for chlamydia, gonorrhea, syphilis. "
    "Question mark over them. Knee OA on X-ray beside them. "
    "Label: STI TESTING. Reactive arthritis is acute monoarthritis in young sexually active patients. "
    "This is a degenerative joint in an older adult. Not indicated. "

    "RIGHT SIDE, WHAT SHE NEEDED (amber-gold glow): Treatment ladder ascending upward. "
    "Bottom: WEIGHT LOSS (calorie-restricted diet). Next: PHYSICAL THERAPY (quad strengthening). "
    "Next: DULOXETINE (SNRI, spinal pain modulation, safe with PUD). Next: INTRA-ARTICULAR STEROID "
    "(triamcinolone into joint space). Top: SURGERY AS LAST RESORT. "
    "Side annotations: COX-independent. No GI risk. Conservative first. "

    "TOP TITLE: 45 PERCENT. TREATMENT 0 PERCENT. YOU HEARD THE CONTRAINDICATION. YOU ORDERED IT ANYWAY. "
    "BOTTOM BANNER: KNEE OSTEOARTHRITIS. Diagnosis was right. Every treatment after was wrong. "
    "Warm amber light on correct path. Cool blue clinical light on patient."
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\knee-osteoarthritis-2026-07-27\images\knee-osteoarthritis-gaps.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
