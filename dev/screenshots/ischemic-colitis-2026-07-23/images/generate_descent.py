"""Magnific: Ischemic Colitis 3x3 descent detective grid."""
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

MASTER_ENV = Path(r"C:\Users\steve\.cursor\master.env")
API_BASE = "https://api.magnific.com"
ENDPOINT = "/v1/ai/text-to-image/nano-banana-pro"
OUT_DIR = Path(r"C:\Users\steve\MeWorld\dev\screenshots\ischemic-colitis-2026-07-23\images")
OUT_DIR.mkdir(parents=True, exist_ok=True)

API_KEY = re.search(
    r"MAGNIFIC_API_KEY=(\S+)", MASTER_ENV.read_text(encoding="utf-8")
).group(1)

PROMPT = (
    "Naughty Dog cinematic CGI style, volumetric rays, PBR materials, dramatic key light "
    "with deep falloff into near-black shadow, cinematic concept still — not a photograph, "
    "not a textbook diagram, not flat medical illustration.\n"
    "Film grain, high contrast, near-black void isolating every panel.\n"
    "Consistent volumetric lighting.\n"
    "No text, labels, numbers, UI, captions, or arrows anywhere.\n\n"
    "3x3 grid, 9 panels, one unbroken descent.\n\n"
    "Story Spine: A 65yo vasculopath arrives hypotensive with left-sided pain. Maroon stool "
    "narrows it to mid-colon. Labs show prerenal AKI and acidosis — the gut is being starved. "
    "Colonoscopy returns normal but the patient is bleeding — the disconnect. Submucosa dying "
    "while surface looks pink. Day 2: drowsy, decompensating. CT reveals pneumatosis in the "
    "splenic flexure watershed. Surgery called.\n\n"
    "Camera: wide arrival, dolly anatomy, macro stool, crash monitors, medium scope, "
    "macro submucosa, wide Day 2, bird's-eye CT, worm's-eye OR.\n\n"
    "Panel 1 (ONCE — wide, ED): 65M on gurney, pale, hand to left abdomen. Monitor: BP 88/58, "
    "HR 112. IV LR running. Clinical urgency. The detective begins.\n\n"
    "Panel 2 (EVERY DAY — dolly, mesenteric): SMA and IMA branching into arcades. Splenic "
    "flexure the watershed gap. Atherosclerotic plaques in vessel walls. Perfusion tenuous.\n\n"
    "Panel 3 (UNTIL — macro, stool): Basin of maroon stool. Not black (upper GI hematin). "
    "Not bright red (distal). Maroon = mid-colon, splenic flexure. Color narrows the map.\n\n"
    "Panel 4 (BECAUSE — crash, monitors): BP 88/58, HR 112. Lab panel: BUN 52, Cr 1.70, "
    "bicarb 20. Volume loss leads to cardiac output drops then splanchnic constriction then "
    "gut perfusion collapses then prerenal AKI.\n\n"
    "Panel 5 (THEREFORE — medium, scope): Colonoscopic view. Pink mucosa, deceptively normal. "
    "No AVM, diverticula, polyps. Patient bleeding maroon, scope sees nothing.\n\n"
    "Panel 6 (BUT — macro, submucosa): Cross-section same colon. Surface pink. Beneath: dying "
    "submucosa, bacteria translocating, blood pooling, gas bubbles forming. Scope cannot see this.\n\n"
    "Panel 7 (THEREFORE — wide, Day 2): Same bed, same patient. Eyes half-closed, difficult to "
    "rouse. Acidosis deepening. Normal test plus worsening patient = wrong test.\n\n"
    "Panel 8 (UNTIL — bird's-eye, CT): CT cross-section on monitor: dark gas bubbles tracing "
    "colonic wall — pneumatosis. Radiolucent crescents in dead tissue. Splenic flexure. Case solved.\n\n"
    "Panel 9 (EVER SINCE — worm's-eye, OR): From below table, surgical lights above. Surgeon's "
    "hands lifting dusky necrotic colon. The algorithm: vasculopath + hypotension + left pain + "
    "maroon + normal scope = watershed infarct leads to CT leads to pneumatosis leads to surgery.\n\n"
    "Consistent volumetric lighting, deep black void, no flat diagrams, no histological slides, "
    "no cutaways."
)

print(f"Prompt chars: {len(PROMPT)}")
if len(PROMPT) > 2990:
    PROMPT = PROMPT[:2990]
    print("Trimmed to 2990.")

body = {
    "prompt": PROMPT[:2990],
    "aspect_ratio": "16:9",
    "resolution": "2K",
}
req = urllib.request.Request(
    f"{API_BASE}{ENDPOINT}",
    data=json.dumps(body).encode("utf-8"),
    headers={"x-magnific-api-key": API_KEY, "Content-Type": "application/json"},
    method="POST",
)
print("Submitting to Magnific...")
with urllib.request.urlopen(req, timeout=120) as resp:
    created = json.loads(resp.read().decode("utf-8"))
task_id = (created.get("data") or created).get("task_id") or created.get("task_id")
print(f"Task ID: {task_id}")

deadline = time.time() + 600
image_url = None
while time.time() < deadline:
    time.sleep(3)
    poll = urllib.request.Request(
        f"{API_BASE}{ENDPOINT}/{task_id}",
        headers={"x-magnific-api-key": API_KEY},
    )
    try:
        with urllib.request.urlopen(poll, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 429:
            time.sleep(8)
            continue
        raise SystemExit(f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')}")
    data = payload.get("data") or payload
    status = str(data.get("status") or "").upper()
    elapsed = int(time.time() - (deadline - 600))
    print(f"[{elapsed}s] Status: {status}")
    if status == "COMPLETED":
        image_url = (data.get("generated") or [None])[0]
        break
    if status == "FAILED":
        raise SystemExit(f"FAILED: {data.get('message') or data}")

if not image_url:
    raise SystemExit("Timed out after 600s")

out_path = OUT_DIR / "descent-detective-3x3.png"
print(f"Downloading from: {image_url[:80]}...")
with urllib.request.urlopen(image_url, timeout=120) as resp:
    raw = resp.read()
out_path.write_bytes(raw)

# Save prompt file
prompt_path = OUT_DIR / "descent-detective-3x3.prompt.txt"
prompt_path.write_text(PROMPT, encoding="utf-8")

size_kb = len(raw) / 1024
print(f"Saved: {out_path} ({size_kb:.0f} KB)")
print(f"Model: nano-banana-pro (2K, 16:9)")
print(f"Prompt saved: {prompt_path}")
