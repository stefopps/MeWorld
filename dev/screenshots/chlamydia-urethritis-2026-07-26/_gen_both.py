import requests, time, os, base64

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "3x3 grid, chlamydia urethritis storyboard. Naughty Dog cinematic CGI, Uncharted 4 visual language: "
    "golden-hour volumetric light, teal-amber palette, soft film grain, shallow depth of field. "
    "PANEL 1: Young man in clinic waiting room. Expression of discomfort. "
    "Hand near groin area. Clinical setting. "
    "PANEL 2: Doctor taking history in exam room. Patient describing symptoms. "
    "Diagram on wall showing urinary tract. "
    "PANEL 3: Physical exam. Gloved hands examining genitalia. "
    "Purulent urethral discharge visible. Clinical lighting. "
    "PANEL 4: Urine sample being collected. First-catch technique. "
    "Label showing NAAT test for chlamydia and gonorrhea. "
    "PANEL 5: Microscopic view. Chlamydia trachomatis inclusion bodies inside epithelial cell. "
    "Elementary bodies and reticulate bodies visible. Cellular biology rendering. "
    "PANEL 6: Azithromycin capsules on pharmacy counter. Prescription being filled. "
    "Cefixime bottle beside it. Label: SINGLE DOSE AZITHROMYCIN + GONORRHEA COVERAGE. "
    "PANEL 7: Doctor counseling patient. Hand gestures explaining. "
    "Brochure on safe sex practices visible on desk. Partner notification form. "
    "PANEL 8: Calendar showing 7 days circled. Patient abstaining. "
    "Follow-up visit. Doctor giving thumbs up. "
    "PANEL 9: Recovery. Patient back to normal activities. No symptoms. "
    "Healthy lifestyle. Outdoor scene with friends. Resolution complete."
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\chlamydia-urethritis-2026-07-26\images\descent-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)

# Gaps plate
prompt2 = (
    "3x3 grid, chlamydia preventive care bundle teaching plate. "
    "Naughty Dog cinematic CGI, Uncharted 4 visual language: teal-amber palette, soft film grain. "
    "PANEL 1: Chlamydia trachomatis lifecycle diagram. Elementary body attaching to epithelial cell. "
    "Reticulate body replicating inside inclusion. EB release. Label: OBLIGATE INTRACELLULAR PATHOGEN - ATP PARASITE. "
    "PANEL 2: Urine dipstick showing negative leukocyte esterase and nitrites. "
    "First-catch urine cup beside it with NAAT label. Label: UA CAN BE NEGATIVE IN URETHRITIS - DIAGNOSE BY NAAT. "
    "PANEL 3: Two test vials: Chlamydia NAAT positive in red. Gonorrhea NAAT pending. "
    "Label: 20 percent MEN WITH CHLAMYDIA HAVE GONORRHEA - ALWAYS CO-TEST. "
    "PANEL 4: Azithromycin 1g single dose packaging. Doxycycline 100mg BID alternative. "
    "Label: TREATMENT = AZITHROMYCIN SINGLE DOSE OR DOXYCYCLINE x 7 DAYS. "
    "PANEL 5: HIV test kit, Hepatitis B and C serology tubes. "
    "Label: ONE STI EQUALS SCREEN FOR ALL - HIV, HBV, HCV. "
    "PANEL 6: Calendar showing day 0 (treatment) and day 7 circled. "
    "Couple icon with red line through it days 0-7. Label: NO INTERCOURSE 7 DAYS POST AZITHROMYCIN. "
    "PANEL 7: Partner notification. Phone with text message: Your partner tested positive - you need treatment. "
    "Prescription being handed. Label: PARTNER TREATMENT - REINFECTION PREVENTION. "
    "PANEL 8: Counseling checklist: SAFE SEX, CONDOMS, SMOKING CESSATION, NO DRUGS. "
    "Doctor and patient in conversation. Label: STI VISIT = PREVENTIVE COUNSELING BUNDLE. "
    "PANEL 9: Follow-up. Patient symptom-free. Test-of-cure negative. "
    "Label: CORRECT DIAGNOSIS AND TREATMENT PLUS PREVENTIVE BUNDLE = CURED AND PROTECTED."
)

print(f"Gaps prompt: {len(prompt2)} chars", flush=True)
payload2 = {"prompt": prompt2, "resolution": "2K", "reference_images": [{"image": ref_b64, "mime_type": "image/png"}]}

print("Submitting gaps...", flush=True)
r2 = requests.post(ENDPOINT, json=payload2, headers=headers, timeout=60)
td2 = (r2.json().get("data") or r2.json())
tid2 = td2.get("task_id")
print(f"Task: {tid2}", flush=True)

status2 = "pending"
while status2.upper() not in ("COMPLETED","FAILED","CANCELLED"):
    time.sleep(10)
    pu = f"https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro/{tid2}"
    sr = requests.get(pu, headers=headers, timeout=30)
    sd = (sr.json().get("data") or sr.json())
    status2 = str(sd.get("status","")).upper()
    print(f"  {status2}", flush=True)

if status2 == "COMPLETED":
    urls = sd.get("generated",[])
    if urls:
        url = urls[0] if isinstance(urls[0],str) else urls[0].get("url","")
        img_r = requests.get(url, timeout=120)
        out = r"C:\Users\steve\MeWorld\dev\screenshots\chlamydia-urethritis-2026-07-26\images\descent-gaps-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
