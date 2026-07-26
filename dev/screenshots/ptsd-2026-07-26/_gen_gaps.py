import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "3x3 grid, PTSD diagnostic criteria and missed interventions teaching plate. "
    "Naughty Dog cinematic CGI, Uncharted 4 visual language: golden-hour volumetric light, teal-amber palette, soft film grain. "
    "PANEL 1: Calendar showing 5 weeks circled. DSM-5 book open. Acute Stress Disorder crossed out in red (3 days to 1 month). "
    "PTSD highlighted in gold (>1 month). Label: CRITERION F - THE 1 MONTH LINE. "
    "PANEL 2: Brain cross-section. Amygdala glowing red (hyperactive). Prefrontal cortex dim blue (underactive). "
    "Hippocampus visibly shrunken. Circuit diagram showing failed inhibitory GABA connection. Label: FAILED FEAR EXTINCTION - PFC CANNOT INHIBIT AMYGDALA. "
    "PANEL 3: Blood draw with labeled tubes: CBC, TSH, CMP. Medical mimics list beside them: "
    "ANEMIA, HYPERTHYROIDISM, HYPONATREMIA. Label: RULE OUT MEDICAL MIMICS BEFORE PSYCHIATRIC DIAGNOSIS. "
    "PANEL 4: SSRI capsule (Sertraline) with chemical diagram. Serotonin synapse diagram. "
    "Raphe nuclei projecting to amygdala and prefrontal cortex. Label: SSRI - RESTORES SEROTONERGIC BRAKE ON AMYGDALA. "
    "PANEL 5: Therapy office. Therapist and patient facing each other. Thought bubbles with trauma memories being reorganized. "
    "Label: PSYCHOTHERAPY - CBT, PROLONGED EXPOSURE, EMDR. "
    "PANEL 6: Split screen. Left: patient alone at home avoiding, curtains drawn. Right: same patient walking outside with family at dusk. "
    "Label: COMBINED TREATMENT - SSRI PLUS THERAPY = RESTORED FUNCTION. "
    "PANEL 7: Office visit checklist. Items: PHYSICAL EXAM general appearance and neuro/psych, CBC, TSH, CMP, PSYCH CONSULT, SSRI. "
    "All items unchecked with red X marks. Label: ZERO ORDERS PLACED. "
    "PANEL 8: DSM-5 PTSD criteria page. Eight criteria boxes (A through H). "
    "All eight checked green including F (>1 month). Label: THIS PATIENT MEETS ALL 8 DSM-5 CRITERIA. "
    "PANEL 9: Recovery timeline. Month 1: diagnosis and treatment start. Month 2: symptom reduction. "
    "Month 3: functional improvement (back to work, social). Month 6: maintenance. Label: THE PTSD TREATMENT ARC - GRADUAL RECOVERY."
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\ptsd-2026-07-26\images\descent-gaps-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
