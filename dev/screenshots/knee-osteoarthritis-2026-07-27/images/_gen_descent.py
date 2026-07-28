import base64, time, os, requests

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"

ref_path = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(ref_path, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = (
    "3x3 grid, knee osteoarthritis storyboard. Naughty Dog Uncharted 4 visual language: "
    "teal-blue-amber palette, film grain, volumetric haze. "

    "PANEL 1: Woman in clinic exam room holding painful right knee. "
    "Knee X-ray on lightbox: joint space narrowing, osteophytes, subchondral sclerosis. "
    "Label: OSTEOARTHRITIS. X-ray confirms the diagnosis. "

    "PANEL 2: 3D cutaway of knee cartilage. Aggrecan molecules (bottle-brush proteoglycans) losing their "
    "chondroitin sulfate bristles. Water escaping. Collagen mesh fraying. Cartilage surface roughening. "
    "Label: CARTILAGE BREAKDOWN. Aggrecan loss causes osmotic collapse. Shock absorber fails. "

    "PANEL 3: Split warning screen. Stomach cross-section with PUD ulcer. Ketorolac molecule under red X. "
    "COX-1 enzyme blocked. Mucus dropping, blood flow dropping, bleed risk glowing. "
    "Label: NSAIDs CONTRAINDICATED. PUD plus COX-1 blockade equals tenfold GI bleed risk. "

    "PANEL 4: 3D view of descending pain pathway. Brainstem sending serotonin and NE axons to spinal dorsal horn. "
    "Duloxetine molecule blocking reuptake transporter. Pain signal from knee attenuated at spinal gate. "
    "Label: DULOXETINE SNRI. Central analgesia via descending pathway modulation. Zero GI risk. "

    "PANEL 5: Physician injecting triamcinolone into knee joint. Synovial macrophages calming. "
    "Prednisone crossed out (needs liver), triamcinolone highlighted (direct local action). "
    "Label: INTRA-ARTICULAR STEROID. Triamcinolone directly into joint space. Weeks of relief. PUD safe. "

    "PANEL 6: PT gym. Patient doing quadriceps exercises with therapist. "
    "Anatomy showing quad absorbing load from joint. "
    "Label: PHYSICAL THERAPY. Strengthen muscles. Gait training. First-line conservative. "

    "PANEL 7: Scale showing weight loss. Infographic: 10 lbs lost equals 30-40 lbs less joint force per step. "
    "Label: WEIGHT LOSS. Every pound off equals 3-4 pounds off the knee. "

    "PANEL 8: Treatment ladder ascending: weight loss then PT then duloxetine then IA steroid. "
    "Surgery at very top with warning: EXHAUST CONSERVATIVE FIRST. You started at the top. "
    "Label: THE OA LADDER. Conservative first. Surgery last. Go back to the bottom. "

    "PANEL 9: Same patient walking comfortably. Pain scale dropping from 7 to 2. "
    "PT progress chart. Duloxetine bottle. Weight tracker. "
    "Label: THE GOAL. Pain controlled. Function preserved. Conservative management works. "

    "Bottom banner: KNEE OSTEOARTHRITIS. She told you she cannot take NSAIDs. Listen. "
    "Duloxetine for pain. Steroid for flares. PT for strength. Weight loss for load. Surgery last."
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
        out = r"C:\Users\steve\MeWorld\dev\screenshots\knee-osteoarthritis-2026-07-27\images\knee-osteoarthritis-descent-3x3.png"
        with open(out,"wb") as f: f.write(img_r.content)
        print(f"SAVED: {os.path.getsize(out)/1048576:.1f} MB", flush=True)
