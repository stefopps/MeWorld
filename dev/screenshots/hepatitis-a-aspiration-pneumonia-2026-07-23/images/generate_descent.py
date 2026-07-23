import requests
import time
import os
import sys

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
OUTPUT_DIR = r"C:\Users\steve\MeWorld\dev\screenshots\hepatitis-a-aspiration-pneumonia-2026-07-23\images"
PNG_PATH = os.path.join(OUTPUT_DIR, "descent-3x3.png")
PROMPT_PATH = os.path.join(OUTPUT_DIR, "descent-3x3.prompt.txt")

PROMPT = """Naughty Dog cinematic CGI style, volumetric rays, PBR materials, dramatic key light with deep falloff into near-black shadow, cinematic concept still — not a photograph, not a textbook diagram, not flat medical illustration. Film grain, high contrast, near-black void. No text, labels, numbers, UI anywhere.
Consistent volumetric lighting across all panels.

3x3 grid, 9 panels, one unbroken descent.

Story Spine: A 35-year-old man returns from a Caribbean cruise with RUQ pain, vomiting, and yellow skin. Fecal-oral transmission through contaminated food. Intractable vomiting causes aspiration into the right lower lobe. Labs: AST 3117, ALT 2362, Tbili 23.7 — the liver under siege. Hepatitis A IgM positive. Foul breath is fetor hepaticus — sulfur compounds bypassing the failing liver. Oxygen, antiemetics, fluids. The liver heals over weeks. Self-limited. The body wins.

Camera: wide cruise, macro transmission, medium cabin, bird's-eye RLL, macro hepatocyte, macro breath, medium lab, dolly treatment, wide clinic.

Panel 1 (ONCE — wide, cruise): Caribbean cruise ship at golden sunset. Beverage station — one glass of contaminated water, faint viral particles invisible. The vector. The opening frame.

Panel 2 (EVERY DAY — macro, gut): Fecal-oral route at cellular scale. HAV particles (icosahedral, 27nm) transiting intestinal epithelium into portal circulation. Heading for hepatocytes. The journey begins.

Panel 3 (UNTIL — medium, cabin): Below deck. 35M doubled over, hand on RUQ, gripping bathroom sink. Vomiting into basin. Jaundice beginning at sclerae. The body turning yellow.

Panel 4 (BECAUSE — bird's-eye, RLL): Right lower lobe bronchial tree at macro scale. Gastric contents aspirating during vomiting — turbid fluid descending into dependent airways. Alveoli filling. Chemical pneumonitis igniting.

Panel 5 (THEREFORE — macro, liver): Hepatocyte at extreme magnification. Viral particles inside cytoplasm. ER disrupted. Mitochondria swelling. Bilirubin pooling as golden pigment. The cell dying from within.

Panel 6 (BUT — macro, breath): Exhaled air — dimethyl sulfide vapor escaping. Fetor hepaticus. Sulfur compounds bypassing hepatic metabolism, exiting through lungs. The smell that tells you the liver is failing.

Panel 7 (THEREFORE — medium, lab): Hepatitis panel under lab light. IgM band glowing positive on assay strip. The molecular lock. HAV confirmed. Differential collapses to one.

Panel 8 (UNTIL — dolly, treatment): IV line, LR running. Oxygen cannula. Ondansetron blocking receptors — nausea suppressed. Same hepatocyte clearing viral particles. Regeneration beginning.

Panel 9 (EVER SINCE — wide, clinic): Same man, follow-up. Skin clear, no jaundice. Liver edge normal. Lab slip: AST 40, ALT 35, Tbili 1.0. Handshake with physician. Self-limited. The body won.

Consistent volumetric lighting, deep black void, no flat diagrams, no histological slides."""

def main():
    # Save prompt.txt
    with open(PROMPT_PATH, "w", encoding="utf-8") as f:
        f.write(PROMPT)
    print(f"[1/5] Prompt saved: {PROMPT_PATH} ({len(PROMPT)} chars)")

    # Submit to Magnific
    payload = {
        "prompt": PROMPT,
        "aspect_ratio": "16:9",
        "resolution": "2K"
    }
    headers = {
        "x-magnific-api-key": API_KEY,
        "Content-Type": "application/json"
    }

    print(f"[2/5] Submitting to Magnific ({ENDPOINT})...")
    resp = requests.post(ENDPOINT, json=payload, headers=headers, timeout=60)

    if resp.status_code != 200:
        print(f"ERROR: API returned {resp.status_code}")
        print(resp.text[:1000])
        sys.exit(1)

    resp_json = resp.json()
    print(f"  Response keys: {list(resp_json.keys())}")

    # Unwrap 'data' envelope if present
    data = resp_json.get("data", resp_json)

    task_id = data.get("task_id") or data.get("id") or data.get("job_id")
    if not task_id:
        print("ERROR: No task_id in response")
        print(f"  Full response: {resp_json}")
        sys.exit(1)

    print(f"  Task ID: {task_id}")

    # Poll until complete
    poll_url = f"{ENDPOINT}/{task_id}"
    max_polls = 60  # 3 min max
    print(f"[3/5] Polling {poll_url} every 3s...")

    for i in range(max_polls):
        time.sleep(3)
        poll_resp = requests.get(poll_url, headers={"x-magnific-api-key": API_KEY}, timeout=30)

        if poll_resp.status_code != 200:
            print(f"  Poll {i+1}: HTTP {poll_resp.status_code}")
            continue

        poll_data = poll_resp.json()
        # Unwrap 'data' envelope if present
        poll_data = poll_data.get("data", poll_data)
        status = poll_data.get("status") or poll_data.get("state", "")
        progress = poll_data.get("progress", "?")
        elapsed = (i + 1) * 3
        print(f"  Poll {i+1} ({elapsed}s): status={status}, progress={progress}")

        if status.upper() == "COMPLETED":
            print(f"  Generation complete after {elapsed}s!")

            # Find generated image URL
            generated = poll_data.get("generated") or poll_data.get("images") or poll_data.get("output", [])
            if isinstance(generated, list) and len(generated) > 0:
                img_url = generated[0] if isinstance(generated[0], str) else generated[0].get("url", "")
            elif isinstance(generated, str):
                img_url = generated
            else:
                # Try other common fields
                img_url = poll_data.get("output_url") or poll_data.get("result_url") or ""

            if not img_url:
                print(f"ERROR: No image URL in completed response. Keys: {list(poll_data.keys())}")
                print(f"  Generated field: {generated}")
                sys.exit(1)

            print(f"[4/5] Downloading image: {img_url[:120]}...")
            img_resp = requests.get(img_url, timeout=120)
            if img_resp.status_code != 200:
                print(f"ERROR: Download failed HTTP {img_resp.status_code}")
                sys.exit(1)

            with open(PNG_PATH, "wb") as f:
                f.write(img_resp.content)
            size_kb = len(img_resp.content) / 1024
            print(f"[5/5] Saved: {PNG_PATH} ({size_kb:.1f} KB)")

            print("\n=== DONE ===")
            print(f"  Model: nano-banana-pro")
            print(f"  Task ID: {task_id}")
            print(f"  File: {PNG_PATH}")
            print(f"  Size: {size_kb:.1f} KB")
            print(f"  Prompt: {PROMPT_PATH}")
            sys.exit(0)

        elif status.upper() in ("FAILED", "ERROR"):
            print(f"ERROR: Generation failed: {poll_data}")
            sys.exit(1)

    print("ERROR: Timed out waiting for generation")
    sys.exit(1)

if __name__ == "__main__":
    main()
