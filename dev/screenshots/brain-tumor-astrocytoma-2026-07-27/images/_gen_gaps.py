"""Generate gaps plate for Brain Tumor — Diffuse Astrocytoma case."""

import base64, time, os, requests

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "Single cinematic medical teaching still. Naughty Dog Uncharted 4 visual language: teal-blue-amber palette, "
    "cool clinical light, warm focal accent, film grain, volumetric haze, shallow depth of field. "

    "CENTER: Woman in hospital bed, early morning light. Hand clutching her head in pain. "
    "Behind her: massive 3D cutaway of skull revealing infiltrative mass in left frontal lobe — the astrocytoma. "
    "Vasogenic edema as wispy blue-white glow expanding around tumor. Below bed: empty prescription pads and IV bags — missed treatment. "

    "SURROUNDING THE PATIENT, nine translucent floating panels with missed orders: "

    "1. DEXAMETHASONE (largest, top, amber-gold glow): Dexamethasone molecule docking into glucocorticoid receptor "
    "on blood-brain barrier endothelial cell. Tight junctions sealing. Edema retreating. "
    "Label: DEXAMETHASONE 4-8mg IV q6h. Seals leaky BBB. Reduces vasogenic edema. 18.18% treatment score starts here. "

    "2. RADIATION ONCOLOGY (upper left): Linear accelerator machine. Radiation beams converging on glowing brain tumor. "
    "Label: RADIATION ONCOLOGY. Diffuse astrocytomas need surgery plus radiation. "

    "3. HEMATOLOGY/ONCOLOGY (upper right): Chemotherapy infusion with temozolomide structure in IV bag. "
    "Label: MEDICAL ONCOLOGY. IDH mutation testing. Adjuvant chemo. Surveillance. "

    "4. ANTI-EMETICS (mid left): Ondansetron molecule blocking 5-HT3 receptors in area postrema. "
    "Label: ANTI-EMETICS. Central nausea from ICP. Ondansetron or promethazine. "

    "5. NPO (mid center): Surgical scheduling board behind NPO bedside sign. "
    "Label: NPO. She's going to the OR. Nothing by mouth. "

    "6. TYPE AND SCREEN (mid right): Blood bank refrigerator. Crossmatched units glowing. "
    "Label: TYPE AND SCREEN. Always with PT/PTT for surgical patients. "

    "7. IV FLUIDS (lower left): Normal saline bag dripping into IV line. "
    "Label: MAINTENANCE IVF. NPO plus steroids equals prevent dehydration. "

    "8. CMP/BMP (lower center): Chemistry panel results on monitor. Electrolytes, glucose, renal function. "
    "Label: CMP/BMP. Pre-op labs. Always with CBC. "

    "9. CANCER COUNSELING (lower right): Physician's hand touching patient's hand. Warm amber light. "
    "Label: COUNSELING. She just learned she has a brain tumor. Tell her the plan. "

    "TOP TITLE: 56.87 PERCENT — YOU FOUND THE TUMOR. THEN YOU STOPPED. "
    "BOTTOM BANNER: TREATMENT SCORE 18.18 PERCENT. Diagnose. Stabilize. Treat symptoms. Consult. Counsel. Be the attending. "
    "Warm amber light on text. Cool blue clinical light on patient and anatomy. 2K resolution cinematic CGI."
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\brain-tumor-astrocytoma-2026-07-27\images\brain-tumor-astrocytoma-gaps.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
