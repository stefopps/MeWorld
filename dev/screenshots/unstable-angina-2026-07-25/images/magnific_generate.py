import requests
import time
import os
import re
import json

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
HEADERS = {
    "x-magnific-api-key": API_KEY,
    "Content-Type": "application/json"
}
OUTDIR = r"C:\Users\steve\MeWorld\dev\screenshots\unstable-angina-2026-07-25\images"
MAX_CHARS = 2900

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def compress_prompt(text):
    """Compress prompt to under MAX_CHARS chars keeping 9-panel structure."""
    lines = text.split("\n")
    result_parts = []
    
    # Short style preamble
    result_parts.append("Naughty Dog cinematic CGI style, volumetric rays, PBR materials, dramatic key light with deep falloff into near-black shadow, film grain, high contrast. No text anywhere.")
    
    # Find the 3x3 grid concept line and trim
    for line in lines:
        l = line.strip()
        if "3x3 grid" in l or "9 panels" in l:
            # Keep the core narrative but trim the em-dash explanations
            concept = l
            # If too long, cut at first em-dash pair
            if len(concept) > 200:
                parts = concept.split(" -- ")
                concept = parts[0] + " -- " + parts[1] if len(parts) > 1 else parts[0]
            result_parts.append(concept)
            break
    
    # Collect panels
    panels = []
    current = ""
    in_panel = False
    
    for line in lines:
        s = line.strip()
        m = re.match(r'Panel\s+(\d+)\s*\((.*?)\)', s)
        if m:
            if current and in_panel:
                panels.append(current.strip())
            pnum = m.group(1)
            plabel = m.group(2)
            current = f"Panel {pnum} ({plabel}):"
            in_panel = True
            continue
        if in_panel and s:
            # Skip metadata lines
            if s.startswith("Camera:") or s.startswith("Consistent"):
                continue
            current += " " + s
    
    if current and in_panel:
        panels.append(current.strip())
    
    # Compress each panel: header + first sentence + one key medical sentence
    compressed = []
    for ptext in panels:
        ci = ptext.index(":") if ":" in ptext else 0
        header = ptext[:ci+1]
        body = ptext[ci+1:].strip()
        
        sentences = re.split(r'(?<=[.!?])\s+', body)
        
        # Keep first 2 sentences (visual description)
        viz_count = min(2, len(sentences))
        viz = " ".join(sentences[:viz_count])
        
        # Find a medical teaching sentence from remaining
        teach = ""
        for s in sentences[viz_count:]:
            if any(kw in s.lower() for kw in [
                "standard", "blocks", "inhibits", "pathway", "activated", 
                "suppressed", "cascade", "saves", "thrombus", "aggregate",
                "fibrin", "perfusion", "stabilization", "monitoring", "safety",
                "secondary", "missing", "unchecked", "starving", "receptor",
                "coagulation", "ischemic", "plaque", "myocardium", "door-to-balloon",
                "troponin", "prevention", "rehabilitation"
            ]):
                teach = s
                break
        
        result = f"{header} {viz}"
        if teach:
            result += f" {teach}"
        
        compressed.append(result)
    
    final = "\n\n".join(result_parts + [""] + compressed)
    final = re.sub(r'\n{3,}', '\n\n', final)
    final = re.sub(r' {2,}', ' ', final)
    
    # If still over, trim longer panels from the end
    if len(final) > MAX_CHARS:
        excess = len(final) - MAX_CHARS + 20
        for i in range(len(compressed)-1, -1, -1):
            if excess <= 0:
                break
            if len(compressed[i]) > 200:
                cut = min(excess, len(compressed[i]) - 160)
                compressed[i] = compressed[i][:len(compressed[i])-cut]
                excess -= cut
        final = "\n\n".join(result_parts + [""] + compressed)
    
    return final[:MAX_CHARS]

def submit_job(prompt, label):
    """Submit to Magnific API, return task_id."""
    payload = {
        "prompt": prompt,
        "resolution": "2K",
        "model": "nano-banana-pro"
    }
    print(f"\n[{label}] Submitting ({len(prompt)} chars)...")
    resp = requests.post(ENDPOINT, headers=HEADERS, json=payload, timeout=60)
    
    if resp.status_code != 200:
        print(f"[{label}] Submit error: {resp.status_code}")
        print(f"[{label}] Response: {resp.text[:800]}")
        return None
    
    data = resp.json()
    inner = data.get("data", data)
    task_id = inner.get("task_id") or inner.get("id")
    status = inner.get("status", "?")
    print(f"[{label}] task_id={task_id} status={status}")
    return task_id

def poll_job(task_id, label, start_time, max_wait=900):
    """Poll using task_id until complete. Return image URL."""
    # Based on response structure, try these URL patterns
    urls = [
        f"https://api.magnific.com/v1/ai/text-to-image/{task_id}",
        f"https://api.magnific.com/v1/ai/text-to-image/{task_id}/status",
        f"https://api.magnific.com/v1/ai/tasks/{task_id}",
        f"https://api.magnific.com/v1/tasks/{task_id}",
    ]
    
    attempt = 0
    while time.time() - start_time < max_wait:
        attempt += 1
        
        for u in urls:
            try:
                resp = requests.get(u, headers=HEADERS, timeout=30)
                if resp.status_code == 200:
                    data = resp.json()
                    inner = data.get("data", data)
                    status = inner.get("status", "")
                    
                    if status in ("completed", "COMPLETED", "succeeded", "SUCCEEDED"):
                        elapsed = time.time() - start_time
                        
                        # Find image URL
                        img_url = None
                        generated = inner.get("generated", [])
                        if generated and len(generated) > 0:
                            g0 = generated[0]
                            img_url = g0.get("url") if isinstance(g0, dict) else g0
                        if not img_url:
                            result = inner.get("result", {})
                            if isinstance(result, dict):
                                img_url = result.get("url") or result.get("image_url")
                            elif isinstance(result, list) and len(result) > 0:
                                r0 = result[0]
                                img_url = r0.get("url") if isinstance(r0, dict) else r0
                        if not img_url:
                            img_url = inner.get("image_url") or inner.get("url") or inner.get("output_url")
                        if not img_url and "images" in inner:
                            imgs = inner["images"]
                            if isinstance(imgs, list) and len(imgs) > 0:
                                img_url = imgs[0].get("url") if isinstance(imgs[0], dict) else imgs[0]
                        
                        print(f"[{label}] COMPLETE after {elapsed:.0f}s. URL found: {bool(img_url)}")
                        if img_url:
                            return img_url
                        else:
                            print(f"[{label}] Full response: {json.dumps(inner, default=str)[:1200]}")
                            return None
                    
                    elif status in ("failed", "FAILED", "error", "ERROR"):
                        print(f"[{label}] FAILED: {json.dumps(inner, default=str)[:500]}")
                        return None
                    
                    elif status in ("processing", "PROCESSING", "pending", "PENDING", "queued", "QUEUED", "running", "RUNNING", "CREATED", "created"):
                        if attempt % 12 == 0:
                            elapsed = time.time() - start_time
                            print(f"[{label}] {status}... ({elapsed:.0f}s)")
                        break
                    
                    else:
                        # Unknown status, log it
                        if attempt <= 3:
                            print(f"[{label}] Unknown status: {status}")
                            print(f"[{label}] Inner: {json.dumps(inner, default=str)[:300]}")
                        break
                elif resp.status_code == 404:
                    continue
            except Exception as e:
                if attempt <= 2:
                    print(f"[{label}] Poll error ({u}): {e}")
                continue
        
        time.sleep(5)
    
    elapsed = time.time() - start_time
    print(f"[{label}] TIMEOUT after {elapsed:.0f}s")
    return None

def download_image(image_url, outpath, label):
    """Download image from URL."""
    print(f"[{label}] Downloading from: {image_url[:120]}...")
    resp = requests.get(image_url, timeout=120)
    if resp.status_code == 200:
        with open(outpath, "wb") as f:
            f.write(resp.content)
        size_kb = len(resp.content) / 1024
        print(f"[{label}] Saved: {outpath} ({size_kb:.1f} KB)")
        return len(resp.content)
    else:
        print(f"[{label}] Download failed: {resp.status_code} {resp.text[:200]}")
        return 0

# ===== MAIN =====
print("=" * 60)
print("MAGNIFIC DUAL IMAGE GENERATION")
print("=" * 60)

prompt1_raw = read_file(os.path.join(OUTDIR, "descent-3x3.prompt.txt"))
prompt2_raw = read_file(os.path.join(OUTDIR, "descent-gaps-3x3.prompt.txt"))

print(f"\nPrompt 1 raw: {len(prompt1_raw)} chars")
print(f"Prompt 2 raw: {len(prompt2_raw)} chars")

prompt1 = compress_prompt(prompt1_raw)
prompt2 = compress_prompt(prompt2_raw)

print(f"Prompt 1 compressed: {len(prompt1)} chars")
print(f"Prompt 2 compressed: {len(prompt2)} chars")

# Save compressed for reference
with open(os.path.join(OUTDIR, "descent-3x3.compressed.txt"), "w", encoding="utf-8") as f:
    f.write(prompt1)
with open(os.path.join(OUTDIR, "descent-gaps-3x3.compressed.txt"), "w", encoding="utf-8") as f:
    f.write(prompt2)

print("\n--- Submitting jobs in parallel ---")
task1 = submit_job(prompt1, "descent-3x3")
task2 = submit_job(prompt2, "descent-gaps-3x3")

if not task1 or not task2:
    print("\nERROR: One or both jobs failed to submit")
    exit(1)

start = time.time()

print("\n--- Polling both jobs (max 15 min) ---")
url1 = poll_job(task1, "descent-3x3", start)
url2 = poll_job(task2, "descent-gaps-3x3", start)

sizes = {}
if url1:
    sizes["descent-3x3.png"] = download_image(url1, os.path.join(OUTDIR, "descent-3x3.png"), "descent-3x3")
if url2:
    sizes["descent-gaps-3x3.png"] = download_image(url2, os.path.join(OUTDIR, "descent-gaps-3x3.png"), "descent-gaps-3x3")

print("\n" + "=" * 60)
print("RESULTS")
print("=" * 60)
for name, size in sizes.items():
    print(f"  {name}: {size/1024:.1f} KB ({size} bytes)")
total = time.time() - start
print(f"  Total time: {total:.0f}s ({total/60:.1f} min)")
print("=" * 60)
