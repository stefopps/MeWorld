import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "3x3 grid, PTSD descent storyboard. Naughty Dog cinematic CGI, Uncharted 4 visual language: "
    "golden-hour volumetric light, teal-amber palette, soft film grain, shallow depth of field. "
    "PANEL 1: Night alley, man being stabbed during robbery. Blade entering chest. Attacker silhouette in shadow. "
    "Wet pavement reflecting streetlight. Traumatic event. "
    "PANEL 2: Emergency department. Man on stretcher with chest wound. Physician suturing. Monitor showing stable vitals. "
    "Bright clinical light. Physical recovery underway. "
    "PANEL 3: Man at home, 2 weeks later. Sitting on edge of bed at 3am. Sweating. Clock showing 3:15. "
    "Nightmare aftermath. Dim bedroom light. First signs of intrusion. "
    "PANEL 4: Man in grocery store daytime. Flinching as someone walks behind him. Hands gripping cart. "
    "Hypervigilance visible in posture. Normal lighting but his expression shows fear. "
    "PANEL 5: Cross-section of brain. Glowing amygdala (red) hyperactive. Prefrontal cortex (blue) dim/underactive. "
    "Hippocampus shrunken. Labels: FAILED EXTINCTION - AMYGDALA UNCHECKED. "
    "PANEL 6: Calendar showing week 5 circled. DSM-5 book open beside it. Arrow pointing: "
    "ACUTE STRESS DISORDER (3 days - 1 month) crossed out. PTSD (>1 month) highlighted. "
    "PANEL 7: Doctor's office. Physician talking to patient. Prescription pad visible. "
    "Referral form for psychology on desk. SSRI bottle (Sertraline) on counter. Calming warm office light. "
    "PANEL 8: Therapy session. Patient sitting across from therapist. "
    "Thought bubbles showing reorganization of trauma memories. "
    "Brain diagram showing restored prefrontal-amygdala balance. "
    "PANEL 9: Recovery. Man walking outside at dusk with family. No longer looking over shoulder. "
    "Calm expression. City lights. Healing complete."
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\ptsd-2026-07-26\images\descent-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
