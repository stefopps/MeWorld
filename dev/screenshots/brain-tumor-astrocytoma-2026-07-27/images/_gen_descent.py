"""Generate descent 3x3 plate for Brain Tumor — Diffuse Astrocytoma case."""

import base64, time, os, requests

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "3x3 grid, brain tumor diffuse astrocytoma clinical arc storyboard. Naughty Dog cinematic CGI, Uncharted 4 visual language: "
    "teal-blue-amber palette, cool clinical overhead light, warm bedside accent, film grain, volumetric haze. "
    "PANEL 1: Woman in her 30s clutching her head at 5 AM in dim bedroom. Dawn light through curtains. "
    "Label: EARLY MORNING HEADACHE. Recumbent position reduces venous drainage. ICP peaks. "
    "PANEL 2: Same woman nauseated, leaning over sink. Medical overlay showing area postrema in medulla glowing. "
    "Label: CENTRAL NAUSEA. Area postrema feels the pressure. "
    "PANEL 3: Fundoscopic view showing swollen optic disc, blurred margins, venous engorgement. "
    "Label: PAPILLEDEMA. Transmitted ICP through subarachnoid sheath. "
    "PANEL 4: CT/MRI scan on monitor in dark reading room. Infiltrative non-enhancing lesion in left frontal lobe. "
    "T2/FLAIR mismatch visible. Label: LOW-GRADE ASTROCYTOMA. T2/FLAIR mismatch. "
    "PANEL 5: 3D cutaway of skull showing left frontal mass pressing against brain tissue. "
    "Monro-Kellie diagram overlay: brain 80%, blood 10%, CSF 10%. Label: MASS EFFECT IN FIXED CRANIAL VAULT. "
    "PANEL 6: Dexamethasone molecule binding to glucocorticoid receptor on blood-brain barrier cell. "
    "Tight junctions sealing. Vasogenic edema retreating. Label: DEXAMETHASONE. High glucocorticoid, zero mineralocorticoid. "
    "PANEL 7: Operating room. Neurosurgeon at microscope resecting tumor. NPO sign on door. IV fluids running. "
    "Anesthesiologist in background. Label: NEUROSURGERY. Debulking. Pre-op: NPO, IVF, Type and Screen. "
    "PANEL 8: Multidisciplinary tumor board. Radiation oncologist, medical oncologist, neurosurgeon reviewing scans. "
    "Cool blue light. Label: MULTIDISCIPLINARY CARE. IDH testing. Radiation. Temozolomide. "
    "PANEL 9: Physician sitting with patient, holding her hand. Warm amber light. Anatomical ghost of tumor receding. "
    "Cancer diagnosis counseling. Compassion. Label: CANCER COUNSELING. Diagnosis. Prognosis. Plan. Hope."
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\brain-tumor-astrocytoma-2026-07-27\images\brain-tumor-astrocytoma-descent-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
