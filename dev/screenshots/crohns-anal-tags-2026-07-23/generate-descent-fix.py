import requests
import time
import json
import os
import sys

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUTPUT_DIR = r"C:\Users\steve\MeWorld\dev\screenshots\crohns-anal-tags-2026-07-23\images"
OUTPUT_PNG = os.path.join(OUTPUT_DIR, "descent-3x3.png")
PROMPT_FILE = os.path.join(OUTPUT_DIR, "descent-3x3.prompt.txt")

PROMPT = """Naughty Dog cinematic CGI style, volumetric rays, PBR materials, dramatic key light with deep falloff into near-black shadow, cinematic concept still — not a photograph, not a textbook diagram, not flat medical illustration. Film grain, high contrast, near-black void. No text, labels, numbers, UI anywhere.
Consistent volumetric lighting across all panels.

3x3 grid, 9 panels, one unbroken descent.

Story Spine: A 30-year-old forest ranger arrives with months of crampy pain, loose stools, weight loss. Perianal skin tags on rectal exam — the sentinel finding. Scope shows skip lesions, cobblestone, terminal ileum, rectal sparing. Biopsy: non-caseating granuloma. Transmural inflammation bores through all four layers. The ileum cannot absorb iron or B12. The diagnosis lands. Budesonide descends as cooling rain onto the cytokine inferno.

Camera: wide office, macro skin tags, bird's-eye scope, macro granuloma, worm's-eye wall, macro ileum, split contrast, dolly treatment, wide resolution.

Panel 1 (ONCE — wide): 30M forest ranger in weathered gear, gaunt, weight loss visible. Hand on abdomen. Afternoon light through clinic window. The detective sits across.

Panel 2 (EVERY DAY — macro): Perianal region under exam light. Raised fleshy skin tags at anal verge — thickened, angry pink tissue. The sentinel finding. Extraintestinal Crohn's manifesting where the exam begins.

Panel 3 (UNTIL — bird's-eye): Colonoscopic view across lumen. Skip lesions: inflamed amber patches alternating with normal pink mucosa. Cobblestone terrain — serpentine ulcers between raised polypoid islands. Rectal sparing visible at edge.

Panel 4 (BECAUSE — macro): Dense macrophage aggregate deep in submucosa — golden granular pearl, no central necrosis. Non-caseating granuloma. The histological lock. Light catches cell membranes.

Panel 5 (THEREFORE — worm's-eye): From inside lumen looking out through ileal wall. All four layers burning — mucosa, submucosa, muscularis, serosa. Transmural fire consuming the wall from within.

Panel 6 (BUT — macro): Terminal ileum lumen. Rust-colored iron particles and cobalt-blue B12 molecules drifting toward inflamed villi. Transport channels burned shut — particles rebound. Cannot absorb.

Panel 7 (THEREFORE — split): Left: UC — continuous superficial red mucosa, rectum involved. Right: Crohn's — transmural amber fire, skip pattern, rectal sparing. Same angle, opposite diseases.

Panel 8 (UNTIL — macro): Mesalamine molecule suspended above inflamed mucosa — translucent crystal. Amber-orange cytokine fire raging below. Cooling begins where it touches. The inferno dims.

Panel 9 (EVER SINCE — dolly): Same terminal ileum as Panel 6. Amber inflammation dimmed to cool blue. Villi standing taller. Transport channels reopening. Rust particles absorbing. Cytokine inferno extinguished. Quiet.

Consistent volumetric lighting, deep black void, no flat diagrams, no histological slides."""

print(f"Prompt length: {len(PROMPT)} chars")

# Save prompt file (overwrite)
os.makedirs(OUTPUT_DIR, exist_ok=True)
with open(PROMPT_FILE, "w", encoding="utf-8") as f:
    f.write(f"Prompt ({len(PROMPT)} chars):\n\n")
    f.write(PROMPT)
print(f"Prompt saved: {PROMPT_FILE}")

# Submit generation — NO resolution param, just aspect_ratio
payload = {
    "prompt": PROMPT,
    "aspect_ratio": "16:9"
}
headers = {
    "x-magnific-api-key": API_KEY,
    "Content-Type": "application/json"
}

print("Submitting to Magnific nano-banana-pro (no resolution param)...")
resp = requests.post(ENDPOINT, json=payload, headers=headers, timeout=30)
print(f"Submit status: {resp.status_code}")

if resp.status_code != 200:
    print(f"Error response: {resp.text[:2000]}")
    sys.exit(1)

data = resp.json()
inner = data.get("data", data)
task_id = inner.get("task_id")
status = inner.get("status")

if not task_id:
    print(f"ERROR: Cannot find task_id. Full response:")
    print(json.dumps(data, indent=2)[:2000])
    sys.exit(1)

print(f"Task ID: {task_id}")
print(f"Initial status: {status}")
print(f"Full response: {json.dumps(data, indent=2)[:800]}")

# Poll for completion
POLL_URL = f"{ENDPOINT}/{task_id}"
max_wait = 900
start = time.time()

while True:
    elapsed = time.time() - start
    if elapsed > max_wait:
        print(f"Timed out after {max_wait}s")
        sys.exit(1)

    time.sleep(5)
    poll = requests.get(POLL_URL, headers=headers, timeout=30)

    if poll.status_code != 200:
        print(f"Poll HTTP {poll.status_code}: {poll.text[:300]}")
        continue

    pdata = poll.json()
    pinner = pdata.get("data", pdata)
    status = pinner.get("status")
    error = pinner.get("error")

    if status == "COMPLETED":
        generated = pinner.get("generated", [])
        if generated and len(generated) > 0:
            img_url = generated[0] if isinstance(generated[0], str) else generated[0].get("url", "")
            if not img_url:
                # Try to find URL anywhere in response
                print("Searching for image URL in response...")
                print(json.dumps(pinner, indent=2)[:3000])
                sys.exit(1)

            print(f"[{elapsed:.0f}s] COMPLETED. Downloading...")
            dl = requests.get(img_url, timeout=120)
            if dl.status_code == 200:
                with open(OUTPUT_PNG, "wb") as f:
                    f.write(dl.content)
                size_kb = len(dl.content) / 1024
                print(f"\n=== SUCCESS ===")
                print(f"File: {OUTPUT_PNG}")
                print(f"Size: {size_kb:.1f} KB")
                print(f"Model: nano-banana-pro")
                print(f"Task ID: {task_id}")
            else:
                print(f"Download failed: HTTP {dl.status_code}")
                sys.exit(1)
        else:
            print("COMPLETED but no generated images:")
            print(json.dumps(pinner, indent=2)[:3000])
            sys.exit(1)
        break

    elif status == "FAILED":
        print(f"[{elapsed:.0f}s] FAILED")
        print(f"Error: {error}")
        print(f"Full: {json.dumps(pinner, indent=2)[:2000]}")
        sys.exit(1)

    else:
        print(f"[{elapsed:.0f}s] {status}")
