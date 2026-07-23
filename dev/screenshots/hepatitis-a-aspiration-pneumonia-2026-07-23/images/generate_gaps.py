import requests
import time
import os
import json

MAGNIFIC_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUTPUT_DIR = r"C:\Users\steve\MeWorld\dev\screenshots\hepatitis-a-aspiration-pneumonia-2026-07-23\images"

PROMPT = """Naughty Dog cinematic CGI style, volumetric rays, PBR materials, dramatic key light with deep falloff into near-black shadow, cinematic concept still — not a photograph, not a textbook diagram, not flat medical illustration. Film grain, high contrast, near-black void. No text anywhere.
Consistent volumetric lighting across all panels.

3x3 grid, 9 panels — the nine orders the attending would have placed that were missed.

Story Spine: A 35M returns from a cruise with RUQ pain, vomiting, jaundice. The attending covers every angle: acetaminophen level first, pulse oximetry, amylase/lipase, INR, pain management with fentanyl, antibiotics for aspiration, NPO, contact precautions, vitamin K.

Camera: macro toxin, medium pulse ox, macro pancreas, macro INR, medium pain, medium abx, medium NPO, wide isolation, medium vitamin K.

Panel 1 (ONCE — macro, acetaminophen): Lab bench. Purple-top tube for acetaminophen level. Toxic NAPQI metabolite forming in background — glutathione depleted. AST >3000 in a young person. Must exclude overdose before calling it viral.

Panel 2 (EVERY DAY — medium, pulse ox): Patient's hand on bed rail. Pulse oximeter clipped to index finger. Reading blurred — never checked. He said he couldn't breathe. Simplest test missed.

Panel 3 (UNTIL — macro, pancreas): Pancreatic acinar cells. Amylase and lipase granules inside zymogen vesicles. RUQ pain + vomiting = pancreatitis always on the differential. Two cheap labs to close that branch.

Panel 4 (BECAUSE — macro, INR): Coagulation cascade in bloodstream. Factors II, VII, IX, X — all vitamin K-dependent, all liver-synthesized. Albumin 2.5. Tbili 23.7. The liver isn't making proteins. INR tells how badly.

Panel 5 (THEREFORE — medium, pain): IV line in antecubital fossa. Fentanyl vial drawn into syringe. Warm golden light — relief approaching. Acetaminophen bottle pushed aside (liver). Meperidine pushed aside (normeperidine neurotoxicity). Only one path.

Panel 6 (BUT — medium, antibiotics): IV infusing. Ceftriaxone hanging. Azithromycin piggyback flowing. RLL infiltrate on CXR behind — confirmed aspiration pneumonia. ATS/IDSA: treat like CAP.

Panel 7 (THEREFORE — medium, NPO): Bedside. Mouth closed. Nothing by mouth. Emesis basin on side table. Intractable vomiting means gut rest. Resume when vomiting stops.

Panel 8 (UNTIL — wide, isolation): Hospital room door. Contact precautions signage — gown and gloves. Fecal-oral virus. Staff protected. Family outside: wife, two children. They need Hep A vaccine or immunoglobulin.

Panel 9 (EVER SINCE — medium, vitamin K): Vitamin K ampoule under bright light. Phytonadione — green-gold liquid restoring clotting factor carboxylation. INR elevated because liver can't activate II, VII, IX, X without K. Coagulopathy corrected.

Consistent volumetric lighting, deep black void, no flat diagrams."""

print(f"Prompt length: {len(PROMPT)} chars")
print(f"Limit: 3000 chars")

# Step 1: Submit job
headers = {
    "x-magnific-api-key": MAGNIFIC_KEY,
    "Content-Type": "application/json"
}
body = {
    "prompt": PROMPT,
    "aspect_ratio": "16:9",
    "resolution": "2K"
}

print("\n=== SUBMITTING JOB ===")
print(f"Endpoint: {ENDPOINT}")
print(f"Model: nano-banana-pro")
print(f"Aspect: 16:9, Resolution: 2K")

resp = requests.post(ENDPOINT, json=body, headers=headers, timeout=60)
print(f"Status: {resp.status_code}")
result = resp.json()
print(json.dumps(result, indent=2))

# Handle nested response format: { data: { task_id: ... } }
data = result.get("data", result)
task_id = data.get("task_id") or data.get("id")
if not task_id:
    print("ERROR: No task_id in response")
    exit(1)

print(f"\nTask ID: {task_id}")

# Step 2: Poll until completed
poll_url = f"https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro/{task_id}"
print(f"\n=== POLLING: {poll_url} ===")

max_wait = 300
elapsed = 0
image_url = None

while elapsed < max_wait:
    time.sleep(3)
    elapsed += 3
    
    poll_resp = requests.get(poll_url, headers=headers, timeout=30)
    poll_raw = poll_resp.json()
    poll_data = poll_raw.get("data", poll_raw)
    status = poll_data.get("status", "UNKNOWN")
    print(f"[{elapsed}s] Status: {status}")
    
    if status == "COMPLETED":
        generated = poll_data.get("generated", [])
        if generated:
            image_url = generated[0]
        print(f"Completed! Generated URLs: {generated}")
        break
    elif status == "FAILED":
        print(f"FAILED: {json.dumps(poll_data, indent=2)}")
        exit(1)
else:
    print(f"Timed out after {max_wait}s")
    exit(1)

if not image_url:
    print("ERROR: No image URL in completed response")
    exit(1)

# Step 3: Download image
print(f"\n=== DOWNLOADING IMAGE ===")
print(f"URL: {image_url}")

img_resp = requests.get(image_url, timeout=120, stream=True)
print(f"Status: {img_resp.status_code}")
print(f"Content-Type: {img_resp.headers.get('Content-Type', 'unknown')}")
print(f"Content-Length: {img_resp.headers.get('Content-Length', 'unknown')}")

output_path = os.path.join(OUTPUT_DIR, "descent-gaps-3x3.png")
with open(output_path, "wb") as f:
    for chunk in img_resp.iter_content(chunk_size=8192):
        f.write(chunk)

file_size = os.path.getsize(output_path)
file_size_kb = file_size / 1024
print(f"\nSaved: {output_path}")
print(f"File size: {file_size_kb:.1f} KB ({file_size} bytes)")

# Step 4: Save prompt file
prompt_path = os.path.join(OUTPUT_DIR, "descent-gaps-3x3.prompt.txt")
with open(prompt_path, "w", encoding="utf-8") as f:
    f.write(PROMPT)
print(f"Prompt saved: {prompt_path}")

# Step 5: Report
print(f"\n=== DONE ===")
print(f"Output: {output_path}")
print(f"Size: {file_size_kb:.1f} KB")
print(f"Model: nano-banana-pro")
print(f"Task ID: {task_id}")
print(f"Prompt file: {prompt_path}")
print(f"Prompt chars: {len(PROMPT)}")
