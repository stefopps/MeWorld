import requests
import time
import json
import os
import sys

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUTPUT_PNG = r"C:\Users\steve\MeWorld\dev\screenshots\crohns-anal-tags-2026-07-23\images\descent-3x3.png"
OUTPUT_PROMPT = r"C:\Users\steve\MeWorld\dev\screenshots\crohns-anal-tags-2026-07-23\images\descent-3x3.prompt.txt"

prompt = (
    "Naughty Dog cinematic CGI style, volumetric rays, PBR materials, dramatic key light "
    "with deep falloff into near-black shadow, cinematic concept still — not a photograph, "
    "not a textbook diagram, not flat medical illustration. Film grain, high contrast, "
    "near-black void isolating every panel. Consistent volumetric lighting. No text, labels, "
    "numbers, UI, captions, or arrows anywhere.\n\n"
    "3x3 grid, 9 panels, one unbroken descent.\n\n"
    "Story Spine: Once upon a time a 30-year-old forest ranger had a healthy gut. "
    "Every day the terminal ileum absorbed iron and B12 in peace, mucosal barrier intact, "
    "four tissue layers calm. Until one day immune cells misread the microbiome and fired "
    "TNF-alpha into the wall. Because of that macrophages swarmed the submucosa forming "
    "granulomas, golden inflammatory pearls. Therefore the fire spread transmurally through "
    "all four layers, mucosa to serosa, skip lesions igniting in patches. But the body tried "
    "to heal, raised polypoid islands between linear serpentine ulcers, cobblestone terrain. "
    "Therefore the transmural inflammation bored completely through, fistulous tunnels connecting "
    "lumen to adjacent bowel. Until finally perianal skin tags emerged at the body edge, "
    "the sentinel sign that made the diagnosis. And ever since then the ileum scarring persists, "
    "iron and B12 still cannot absorb through the burned channels.\n\n"
    "Camera: Panel 1 Once Upon A Time establishing wide inside healthy ileum lumen, calm blue light. "
    "Panel 2 Every Day extreme macro of intact villi absorbing blue B12 molecules. "
    "Panel 3 Until One Day crash zoom into a single immune cell releasing orange TNF-alpha fire. "
    "Panel 4 Because Of That dolly zoom into submucosal macrophage cluster forming golden granuloma pearl. "
    "Panel 5 Therefore bird's-eye view along ileum, patchy skip lesions burning amber between normal segments, "
    "all four layers glowing. Panel 6 But dolly out across mucosal surface, raised polypoid islands between "
    "deep fissure ulcers, cobblestone terrain. Panel 7 Therefore through object in, camera diving through "
    "fistulous channel tunneling the full wall thickness, amber glow. Panel 8 Until Finally worm's-eye view "
    "at perianal surface, fleshy skin tags at anal verge, sentinel of disease within. Panel 9 And Ever Since "
    "Then wide payoff pull-back, scarred ileum with rust iron particles and blue B12 bouncing off burned "
    "villi, ghost of mesalamine rain failing to fully heal.\n\n"
    "Consistent volumetric lighting throughout, deep black void isolating every panel, no flat diagrams, "
    "no histological slides, no cutaways."
)

# Hard guard
print(f"Prompt: {len(prompt)} chars")
if len(prompt) > 2995:
    print(f"ERROR: Prompt too long ({len(prompt)} chars). Compress and retry.")
    raise SystemExit(1)
print("Prompt length OK. Firing generation...")

headers = {
    "x-magnific-api-key": API_KEY,
    "Content-Type": "application/json"
}

payload = {
    "prompt": prompt,
    "aspect_ratio": "16:9",
    "resolution": "2K"
}

# Submit generation
print(f"POST {ENDPOINT}")
resp = requests.post(ENDPOINT, json=payload, headers=headers)
print(f"Response status: {resp.status_code}")
resp_data = resp.json()
print(f"Response: {json.dumps(resp_data, indent=2)}")

task_id = (
    resp_data.get("task_id")
    or resp_data.get("id")
    or (resp_data.get("data") or {}).get("task_id")
)
if not task_id:
    print("ERROR: No task_id in response. Full response:")
    print(json.dumps(resp_data, indent=2))
    raise SystemExit(1)

poll_url = f"{ENDPOINT}/{task_id}"
print(f"\nTask ID: {task_id}")
print(f"Polling: GET {poll_url}")

# Poll until completed
max_attempts = 120  # 6 minutes max
for attempt in range(max_attempts):
    time.sleep(3)
    poll_resp = requests.get(poll_url, headers=headers)
    poll_data_raw = poll_resp.json()
    poll_data = poll_data_raw.get("data", poll_data_raw)
    status = poll_data.get("status", "unknown")
    print(f"  Attempt {attempt+1}: status={status}")
    
    if status == "COMPLETED" or status == "completed":
        generated = poll_data.get("generated", [])
        if generated and len(generated) > 0:
            image_url = generated[0]
            print(f"\nImage URL: {image_url}")
            
            # Download image
            print("Downloading image...")
            img_resp = requests.get(image_url)
            img_resp.raise_for_status()
            
            with open(OUTPUT_PNG, "wb") as f:
                f.write(img_resp.content)
            file_size = os.path.getsize(OUTPUT_PNG)
            print(f"Saved: {OUTPUT_PNG}")
            print(f"File size: {file_size:,} bytes ({file_size/1024:.1f} KB)")
            
            # Save prompt text
            with open(OUTPUT_PROMPT, "w", encoding="utf-8") as f:
                f.write(f"Prompt ({len(prompt)} chars):\n\n{payload['prompt']}")
            print(f"Saved prompt: {OUTPUT_PROMPT}")
            
            # Update case-sequence.json
            case_seq_path = r"C:\Users\steve\MeWorld\dev\screenshots\crohns-anal-tags-2026-07-23\case-sequence.json"
            if os.path.exists(case_seq_path):
                with open(case_seq_path, "r", encoding="utf-8") as f:
                    case_data = json.load(f)
            else:
                case_data = {}
            
            case_data["imageGenerationStatus"] = "completed"
            case_data["descentImagePath"] = r"images\descent-3x3.png"
            case_data["descentPromptPath"] = r"images\descent-3x3.prompt.txt"
            case_data["descentPromptLength"] = len(prompt)
            case_data["descentImageSizeBytes"] = file_size
            
            with open(case_seq_path, "w", encoding="utf-8") as f:
                json.dump(case_data, f, indent=2, ensure_ascii=False)
            print(f"\nUpdated case-sequence.json: imageGenerationStatus=completed")
            
            print(f"\n=== GENERATION COMPLETE ===")
            print(f"File: {OUTPUT_PNG}")
            print(f"Size: {file_size:,} bytes")
            print(f"Prompt: {len(prompt)} chars")
            raise SystemExit(0)
        else:
            print("ERROR: Status COMPLETED but no generated images found")
            print(json.dumps(poll_data, indent=2))
            raise SystemExit(1)
    
    elif status == "FAILED" or status == "failed":
        print(f"ERROR: Generation failed.")
        print(json.dumps(poll_data, indent=2))
        raise SystemExit(1)
    
    elif status == "PROCESSING" or status == "processing" or status == "PENDING" or status == "pending":
        continue
    
    else:
        print(f"  Unknown status: {status}. Continuing poll...")
        continue

print(f"ERROR: Timed out after {max_attempts} attempts ({max_attempts * 3}s)")
raise SystemExit(1)
