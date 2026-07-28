import base64, time, os, requests

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "3x3 grid, gastric adenocarcinoma clinical arc storyboard. Naughty Dog Uncharted 4 visual language: "
    "teal-blue-amber palette, cool clinical overhead light, warm bedside accent, film grain, volumetric haze. "

    "PANEL 1: Elderly thin pale man in ED clutching epigastrium. Coffee-ground emesis in basin. "
    "Label: ALARM SYMPTOMS. Weight loss plus epigastric pain plus occult blood. Not GERD. "

    "PANEL 2: 3D cutaway of stomach wall. Correa cascade inside: chronic H. pylori gastritis to "
    "atrophic gastritis to intestinal metaplasia (goblet cells) to invasive adenocarcinoma. "
    "Label: THE CORREA CASCADE. H. pylori drives gastritis to atrophy to metaplasia to cancer. "

    "PANEL 3: Lab bench. CBC showing microcytic anemia. Iron panel on monitor: low iron, low ferritin, high TIBC. "
    "Stomach ghost showing ulcerated tumor bleeding. "
    "Label: IRON DEFICIENCY ANEMIA. Chronic blood loss plus impaired absorption from achlorhydria. "

    "PANEL 4: Endoscopy view on monitor in dark procedure room. Gastroscope entering stomach. "
    "Irregular ulcerated mass on greater curvature. Biopsy forceps approaching. "
    "Label: EGD WITH BIOPSY. Gold standard. CT finds mass. Scope tells you what it is. "

    "PANEL 5: CT scan slices on reading station. Abdomen and pelvis visible. Chest scan highlighted as needed. "
    "Label: COMPLETE STAGING. CT Chest plus Abdomen plus Pelvis. Local extension. Nodes. Distant metastases. "

    "PANEL 6: Oncology suite. FLOT chemotherapy IV bag. Molecular diagrams of fluorouracil, leucovorin, oxaliplatin. "
    "Label: ADJUVANT CHEMOTHERAPY. FLOT regimen. Medical oncology consult post-gastrectomy. "

    "PANEL 7: OR view. Subtotal gastrectomy in progress. NPO sign on door. IV fluids running. "
    "Crossmatched blood units nearby. Label: SURGERY. D2 lymphadenectomy. Pre-op: NPO plus IVF plus Type and Screen. "

    "PANEL 8: Physician at bedside with ferrous sulfate bottle. Warm amber light. Family discussion. "
    "Label: CANCER COUNSELING plus IRON REPLACEMENT. Ferrous sulfate 325mg TID. Replace what was lost. "

    "PANEL 9: Survivorship clinic. Patient healthier post-gastrectomy. B12 injection. Surveillance CT. Dietitian consult. "
    "Label: SURVEILLANCE. Q3-6 month CT plus endoscopy. B12 plus iron replacement. Smoking cessation. "

    "Bottom banner: GASTRIC ADENOCARCINOMA. Not GERD. Not reflux. Cancer pretending to be heartburn."
)

print(f"Prompt: {len(prompt)} chars", flush=True)
payload = {"prompt": prompt, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}
headers = {"x-magnific-api-key": API_KEY, "Content-Type": "application/json"}

print("Submitting descent...", flush=True)
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\gastric-adenocarcinoma-2026-07-27\images\gastric-adenocarcinoma-descent-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
