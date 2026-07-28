import base64, time, os, requests
API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "3x3 grid, giant cell arteritis clinical arc. Naughty Dog Uncharted 4 visual language: "
    "teal-blue-amber palette, film grain, volumetric haze. "

    "PANEL 1: Elderly woman clutching right temple, jaw clenched. Right eye dimmed. "
    "Thickened temporal artery visible on scalp. "
    "Label: GCA SUSPECTED. Headache plus jaw claudication plus amaurosis fugax. Emergency. "

    "PANEL 2: 3D arterial wall cutaway. T-cells infiltrating adventitia. Macrophages fusing into "
    "giant cells at intima-media junction. Elastic lamina fragmenting. Intimal hyperplasia narrowing lumen. "
    "Label: GRANULOMATOUS VASCULITIS. Giant cells destroy internal elastic lamina. Lumen closes. "

    "PANEL 3: Ophthalmic artery branching from ICA. Posterior ciliary arteries to optic nerve head. "
    "Inflamed segment near-occluded. Pale swollen optic disc (AION). "
    "Label: ANTERIOR ISCHEMIC OPTIC NEUROPATHY. Posterior ciliary occlusion starves optic nerve. Hours to blindness. "

    "PANEL 4: Lab bench. ESR tube over 100. CRP elevated on monitor. IL-6 flowing from artery to liver. "
    "Label: ESR plus CRP. IL-6 drives acute phase reactants. Both extremely sensitive. Normal ESR rules out GCA. "

    "PANEL 5: Surgeon excising 3-5 cm temporal artery. Pathology showing giant cells and fragmented lamina. "
    "Steroid IV running simultaneously alongside. Label: TEMPORAL ARTERY BIOPSY. Confirm but never wait. "
    "Start prednisone immediately. Biopsy stays positive 1-2 weeks on steroids. "

    "PANEL 6: Prednisone 60mg tablet glowing. Dexamethasone crossed out in red. "
    "Pharmacokinetic graph: prednisone intermediate half-life vs dexamethasone accumulation. "
    "Label: PREDNISONE NOT DEXAMETHASONE. Flexible taper over months. Visual symptoms: IV methylprednisolone first. "

    "PANEL 7: Vitamin D and calcium bottles. Bone scan showing osteoporosis. "
    "CTA aorta on monitor showing aneurysm screen. "
    "Label: PROTECT. Vitamin D plus calcium day one. Screen aorta. 17x aneurysm risk in GCA. "

    "PANEL 8: Ophthalmologist at slit lamp. Rheumatologist with steroid taper calendar. "
    "Label: OPHTHALMOLOGY plus RHEUMATOLOGY. Monitor vision. Manage 12-18 month taper. "

    "PANEL 9: Patient smiling, walking out. Tdap syringe. Shingrix vial. "
    "Medication calendar. Reassurance note. Label: PREVENTIVE CARE. Vaccines, reassurance, compliance counseling. "

    "Bottom banner: GIANT CELL ARTERITIS. Steroids save the eye. Biopsy confirms. Screening protects the aorta."
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\temporal-arteritis-2026-07-27\images\temporal-arteritis-descent-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
