import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "3x3 grid, fluoroquinolone contraindication in pregnancy teaching plate. "
    "Naughty Dog cinematic CGI, Uncharted 4 visual language: golden-hour volumetric light, teal-amber palette, soft film grain. "
    "PANEL 1: Fluoroquinolone capsule (Ciprofloxacin) with molecular structure. "
    "DNA gyrase enzyme diagram showing drug binding. Label: FQ MECHANISM - INHIBITS DNA GYRASE AND TOPOISOMERASE IV. "
    "PANEL 2: Cross-section of pregnant uterus. Fluoroquinolone molecules crossing placenta into fetal circulation. "
    "Fetus visible. Red warning overlay. Label: FQ CROSSES PLACENTA FREELY. "
    "PANEL 3: Microscopic view of fetal cartilage. Chondrocytes with damaged mitochondria. "
    "Cartilage matrix disrupted. Magnesium ions being chelated. Label: FQ CHELATES Mg2+ IN DEVELOPING CARTILAGE - IRREVERSIBLE ARTHROPATHY. "
    "PANEL 4: Animal study image of damaged joint cartilage. Erosion visible. "
    "Label: ANIMAL DATA - EROSION OF WEIGHT-BEARING JOINTS. HUMAN DATA LIMITED BUT UNIVERSAL CONSENSUS TO AVOID. "
    "PANEL 5: Four pregnancy-safe alternatives in gold frames: "
    "NITROFURANTOIN (2nd-3rd trimesters only), CEPHALEXIN (all trimesters), AMOXICILLIN-CLAVULANATE (all trimesters), FOSFOMYCIN (single dose). "
    "Symbol of shield protecting fetus. "
    "PANEL 6: Two-column table. LEFT: PREGNANCY-SAFE green checkmarks. RIGHT: CONTRAINDICATED red X marks. "
    "Contraindicated column shows: CIPROFLOXACIN, LEVOFLOXACIN, MOXIFLOXACIN, TMP-SMX. "
    "PANEL 7: TMP-SMX pill with molecular structure. Calendar showing trimesters: "
    "1st trimester red (neural tube defects from folate antagonism), 3rd trimester red (kernicterus from bilirubin displacement). "
    "PANEL 8: Sensitivity panel (antibiogram) from culture. Ciprofloxacin S highlighted in green, tempting. "
    "Red arrow pointing left: CHECK PREGNANCY STATUS FIRST. Label: SENSITIVE DOES NOT MEAN SAFE. "
    "PANEL 9: Happy outcome. Pregnant woman taking nitrofurantoin capsule. "
    "Fetal ultrasound showing healthy baby. Follow-up urine culture showing no growth. Label: CORRECT CHOICE = CURED UTI + PROTECTED BABY."
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\uti-pregnancy-2026-07-26\images\descent-gaps-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
