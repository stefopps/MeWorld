import base64, time, os, requests

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "Single cinematic medical teaching still. Naughty Dog Uncharted 4 visual language: teal-blue-amber palette, "
    "cool clinical light, warm focal accent, film grain, volumetric haze, shallow depth of field. "

    "CENTER DOMINANT IMAGE: Elderly man in hospital bed, gaunt and pale, hand on his epigastric area in pain. "
    "Behind him: massive 3D cutaway of his stomach showing an ulcerated mass bleeding slowly into the gastric lumen. "
    "The Correa cascade illustrated as a four-step progression wrapping around the stomach: "
    "H. pylori to chronic gastritis to intestinal metaplasia to adenocarcinoma. "

    "Below the bed: empty scope tray (EGD never done), empty pill bottles (no iron), empty IV pole (no fluids). "
    "The missed treatment. Score: 50.48 percent. "

    "SURROUNDING THE PATIENT, eight translucent floating panels showing MISSED ORDERS: "

    "1. EGD WITH BIOPSY (largest, top center, amber-gold glow): Endoscope entering stomach. Biopsy forceps grasping "
    "tissue from irregular ulcerated mass. Pathology slide showing adenocarcinoma cells. "
    "Label: EGD WITH BIOPSY. CT finds a mass. Scope tells you what it is. Diagnosis 51.06 percent. "

    "2. H. PYLORI TESTING (upper right): Urea breath test bag. H. pylori bacteria glowing on gastric mucosa. "
    "Label: H. PYLORI. The Correa cascade starts here. Eradicate to prevent further damage. "

    "3. CT CHEST (upper left): CT scanner with chest slice on monitor showing clear lung fields. "
    "Label: COMPLETE STAGING. Chest plus Abdomen plus Pelvis. Rule out pulmonary metastases. "

    "4. IRON STUDIES (mid right): Laboratory monitor showing iron panel: low serum iron, low ferritin, high TIBC. "
    "Label: IRON STUDIES. Confirm the mechanism. Low iron plus low ferritin plus high TIBC equals iron deficiency. "

    "5. NPO (mid left): Bedside sign reading NPO with endoscopy schedule board behind it. "
    "Label: NPO. She needs a scope. Nothing by mouth. Pre-procedure order. "

    "6. IV FLUIDS (lower right): Normal saline bag dripping into IV line. Maintenance infusion. "
    "Label: MAINTENANCE IVF. NPO plus awaiting procedures plus anemia plus malignancy equals needs fluids. "

    "7. IRON SUPPLEMENTATION (lower left): Ferrous sulfate 325mg bottle. RBCs regenerating in bone marrow. "
    "Label: FERROUS SULFATE 325mg TID. Replace the iron she lost from months of bleeding. "

    "8. MEDICAL ONCOLOGY (bottom center): Oncology infusion chair. FLOT chemotherapy regimen bag. "
    "Molecular structures of fluorouracil, leucovorin, oxaliplatin, docetaxel. "
    "Label: MEDICAL ONCOLOGY. Adjuvant chemotherapy post-gastrectomy. You consulted surgery. Consult oncology too. "

    "TOP TITLE: 50.48 PERCENT. YOU CAUGHT THE CANCER. YOU MISSED THE SCOPE. "
    "BOTTOM BANNER: GASTRIC ADENOCARCINOMA. The reflux that was never reflux. "
    "Exam labs CT surgery counseling all correct. But no tissue diagnosis. No iron. No oncology. "
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\gastric-adenocarcinoma-2026-07-27\images\gastric-adenocarcinoma-gaps.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
