---
name: ccs-case-workup
description: Complete CCS case workup — OCR screenshots, create dossier with case-sequence.json and README, generate mechanism teaching plates via background sub-agent. Use when Steve finishes a CCS case, says "done" after a case, wants to organize screenshots, or asks to "work up" a case. Handles the full pipeline: OCR → dossier → sequence JSON → image generation.
---

# CCS Case Workup Pipeline

## Quick start

When Steve says "done" or "work up this case" after playing a CCS case:

1. OCR case screenshots in `Pictures\Screenshots\` (Win+PrintScreen captures)
2. **Score page lands in `Downloads\`** — OCR `app.ccscases.com_*.png` sorted by newest
3. Create dossier at `dev/screenshots/<case-slug>-YYYY-MM-DD\`
4. Write `case-sequence.json` + `README.md`
5. Move screenshots into dossier (Copy-Item only, never delete)
6. Generate treatment plates via direct Magnific REST call (single 3x3 grid)
7. Report: dossier path + file counts

## Rules (never violate)

- **Move files only.** Move-Item is fine. Never Remove-Item, del, or rm. See user rule "File safety — NEVER DELETE anything."
- **Verify counts.** After any move, source and destination counts must match.
- **Images always go to the case dossier** — `dev/screenshots/<case>/images/`
- **Image generation ALWAYS runs in a background sub-agent.** Never poll Magnific API inline during main conversation.

## Step 1 — OCR screenshots

**Case playthrough screenshots:** `Pictures\Screenshots\` (Win+PrintScreen captures)

```powershell
python -c "
import pytesseract, glob, os
from PIL import Image
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
files = sorted(glob.glob(os.path.join(r'$env:USERPROFILE\Pictures\Screenshots', 'Screenshot 2026-*.png')))
for f in files:
    img = Image.open(f)
    text = pytesseract.image_to_string(img)
    base = os.path.basename(f)
    print(f'===== {base} =====')
    print(text.strip())
    print('===== END =====')
    print()
"
```

**Score summary screenshot:** `Downloads\` — the CCS score page lands here, not in Pictures\Screenshots

```powershell
# Find the newest score page
Get-ChildItem "$env:USERPROFILE\Downloads" -Filter "app.ccscases.*.png" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
```

## Step 2 — Extract case info from OCR

From the OCR text, extract:
- **Case title** and specialty (e.g. "Diarrhea - Internal Medicine")
- **Patient demographics** (age, sex, presentation)
- **Vital signs** (T, HR, BP, RR, BMI)
- **HPI** (chief complaint, duration, key details)
- **Past medical / family / social history** (red flags like family cancer, smoking)
- **Physical exam** (especially the key finding that turned the case)
- **Orders placed** and their results
- **Diagnosis** (from colonoscopy or similar definitive test)
- **Treatment** ordered
- **Final score** and breakdown (diagnosis %, treatment %, timing %, missed orders)

## Step 3 — Create the dossier

```powershell
$date = Get-Date -Format 'yyyy-MM-dd'
$slug = "<diagnosis>-<key-finding>-<date>"  # e.g. "crohns-anal-tags-2026-07-23"
$dossier = "C:\Users\steve\MeWorld\dev\screenshots\$slug"
New-Item -ItemType Directory $dossier -Force | Out-Null
New-Item -ItemType Directory "$dossier\images" -Force | Out-Null
```

**Slug format:** `<diagnosis>-<key-finding>` — use dashes, lowercase. Examples:
- `crohns-anal-tags`
- `ami-stemi-ecg`
- `dka-anion-gap`
- `pe-hemoptysis`

## Step 4 — Copy screenshots into dossier

**Case screenshots from `Pictures\Screenshots\`:**

```powershell
$src = "$env:USERPROFILE\Pictures\Screenshots"
$dst = $dossier
$files = Get-ChildItem $src -Filter "Screenshot 2026-*.png" | Sort-Object Name
$count = $files.Count
$i = 1
foreach ($f in $files) {
    $newName = "{0:D2}-case.png" -f $i
    Copy-Item $f.FullName (Join-Path $dst $newName) -Force
    $i++
}
```

**Score summary from `Downloads\`:**

```powershell
$scoreFile = Get-ChildItem "$env:USERPROFILE\Downloads" -Filter "app.ccscases.*.png" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($scoreFile) { Copy-Item $scoreFile.FullName "$dst\99-score-summary.png" -Force }

# Verify
Write-Output "Copied $(($i-1)) case screenshots to $dst"
Write-Output "Score summary: $(if ($scoreFile) { 'copied' } else { 'NOT FOUND in Downloads' })"
```

## Step 5 — Write case-sequence.json

Create `case-sequence.json` with this structure:

```json
{
  "caseId": "diagnosis-slug",
  "diagnosis": "Confirmed diagnosis",
  "score": "XX%",
  "patient": {
    "age": 30,
    "sex": "male/female",
    "key": "The single finding that turned the case"
  },
  "sequence": [
    {
      "step": 1,
      "screen": "Screen name from OCR",
      "what": "What was shown",
      "decision": "What the learner should think"
    }
  ],
  "missed": [
    {
      "order": "Missed order name",
      "why": "Clinical mechanism — why this matters for THIS case specifically. Not generic."
    }
  ],
  "mechanismsForImage": [
    {
      "panel": 1,
      "title": "Mechanism name",
      "concept": "One-sentence mechanism description for image prompt"
    }
  ],
  "imageOutputPath": "C:/Users/steve/MeWorld/dev/screenshots/<slug>/images",
  "imageGenerationStatus": "pending"
}
```

**Critical: the `missed` array.** Each `why` must be case-specific, not generic copy-paste. Examples:

- GOOD: "Terminal ileum absorbs iron. Normal Hgb doesn't rule out deficiency — Crohn's inflammation at absorption site = micronutrient depletion before anemia."
- BAD: "CBC is always a good screening tool."

## Step 6 — Write README.md (MANDATORY — attending teaching voice)

**Do NOT write a clinical case summary.** Do NOT use bullet-point lists of vitals, screesnhot tables, or "Correctly Ordered / Should Have Ordered" tables without teaching context. The README is the attending's bedside walkthrough — a mechanism-first, spatially-grounded, visually-oriented explanation of why everything in the case happened the way it did.

### Voice rule — read `immersa-attendant-teaching.mdc` before writing

Follow the Immersa Explainer stack:

1. **Hook** — the surprising or counterintuitive thing. What makes this case unique? What did the learner have to figure out?
2. **Mechanism** — what is actually happening at the molecular/cellular/physical level. Lead with mechanism, not with "this condition causes X."
3. **Spatial Logic** — why HERE and not somewhere else. Distribution, location, timing — explain the geometry or physics.
4. **Connecting Thread** — how this links to other findings. Signs and symptoms are not a list. They are a story told by one underlying process.
5. **Contrast** (when relevant) — compare to a related condition where the mechanism differs, so the distinction becomes self-evident.
6. **Clinical Anchors** — what this means at the bedside. Diagnostic implications, management decisions, things to watch for.
7. **What You Got Right** — narrative, not just a list. Acknowledge the correct moves.
8. **What You Missed** — each missed order with mechanism. Never generic — every "why" must be case-specific.

### Tone

- Confident, direct, short sentences. No hedging. No passive voice.
- Excited by mechanism — there's joy in the explanation.
- Visual cue language: "Picture the..." / "Think of the..." / "Imagine..."
- Never: bullet-point a list of features without explaining why they exist
- Never: "it is thought that..."
- Never: apologize for complexity

### Required sections (in order)

```markdown
# [Diagnosis] — Attending Walkthrough

**Date:** YYYY-MM-DD | **Score:** X% (Avg Y%) | **Patient:** [age/gender, key descriptor]

## Hook
[2-4 sentences setting up the clinical puzzle — what makes this case unique]

## Mechanism: [Title]
[Physics/chemistry/biology that FORCES the findings to happen — not "this disease causes X"]
[The Explanation Stack: mechanism → spatial → connecting thread → contrast → anchors]

## What You Got Right
[Narrative of correct clinical reasoning — what you correctly identified]

## What You Missed
| Missed | Impact |
|--------|--------|
| **Order** | Mechanism-specific reason THIS case needed it |

## Treatment Plates
| Plate | Path | Coverage |
|-------|------|----------|
| Descent | `images/descent-3x3.png` | [One-line arc summary] |
| Gaps | `images/descent-gaps-3x3.png` | [One-line missed orders summary] |
```

### Gold reference

`C:\Users\steve\MeWorld\dev\screenshots\lead-poisoning-encephalopathy-2026-07-23\README.md`

## Step 7 — Build 3x3 descent grid and fire sub-agent

### STYLE LOCK (non-negotiable — violate this and you're wrong)

**The `/descent` style is the ONLY allowed visual style for case workups.**

| FORBIDDEN | REQUIRED |
|---|---|
| "medical scientific illustration" | "Naughty Dog cinematic CGI style" |
| "clean vector-subtle" | "film grain, high contrast, near-black void" |
| "cellular level detail, histology textbook" | "volumetric rays, PBR materials, dramatic key light with deep falloff" |
| 9 individual 1:1 panels | **ONE 3x3 grid image, 16:9 aspect, 2K** |
| Aspect ratio `1:1` | Aspect ratio `16:9` |
| "Dark background (#111111). No text labels. No faces." | Style opener verbatim (see 7b) + "No text, labels, numbers, UI, captions, or arrows anywhere." |
| "Medical illustration." as prefix | "cinematic concept still — not a photograph, not a textbook diagram, not flat medical illustration." |

**Every sub-agent prompt MUST include the full style opener verbatim (see 7a). Never replace it with "medical scientific illustration."**

**Never generate individual panel files (panel-1.png, panel-2.png…). The output is ONE file: `descent-3x3.png`.** The Magnific REST call sends ONE prompt describing all 9 grid cells. Magnific renders the grid natively.

### 7a — Build the Story Spine from the case mechanism

Map the pathophysiology onto the Pixar Story Spine beats:

```
Once upon a time — the patient before disease
Every day — normal physiology
Until one day — the inciting event
Because of that — immediate consequence
Therefore — cascade step 1
But — compensating mechanism
Therefore — cascade step 2 (substrate forming)
Until finally — clinical endpoint / the diagnostic finding
And ever since then — irreversible state / treatment footprint
```

### 7b — Write the prompt (locked Naughty Dog / Uncharted 4 cinematic CGI)

Use the exact Naughty Dog style block from the `/claude-img` medical mechanism image prompting skill.

```
Naughty Dog cinematic CGI macro render, Uncharted 4 / The Last of Us visual style. Not a photograph. Cool blue-gray dominant ambient lighting with warm amber focal accents. Heavy ambient occlusion. Volumetric haze and atmospheric depth. Lived-in worn surfaces with visible material detail. Soft vignette at edges. Warm/cool tension — shadows have color temperature, never pure black. One warm point light catching edges.

3x3 grid, 9 panels, landscape 16:9. NO TEXT ANYWHERE. One continuous environment across all panels, camera traveling through it, no two adjacent panels sharing an angle.

Story: [concise causal chain — 3-4 sentences max]
Camera: [one camera term per panel — vary every panel, never repeat adjacent]
Panel 1-9: [one element per panel; named camera term; mechanism beat]
Cinematic, high contrast, glossy detail, consistent style throughout, no text anywhere.
```

If a human character is in frame, use the human variant from the skill (adds subsurface scattering, skin shader).

**DO NOT use generic "Unreal Engine 5 cinematic" blocks.** The approved visual reference is `dev/screenshots/uncharted-4-main-menu.png` — cool blue-gray dominant, warm focal accents only, volumetric haze, lived-in worn surfaces. UE5 generic produces flat black shadows with no color temperature.

### 7c — Fire generation (Python script, NOT subagent shell delegation)

**CRITICAL: Do NOT delegate Magnific generation to a shell subagent.** Shell subagents hang indefinitely (~705s+) on Magnific polling loops. Instead, use a direct Python script (saved as `_magnific_gen.py` in the images folder) that submits, polls, and downloads.

**Two-plate pattern (descent + gaps):**

```python
import requests, time, os

API_KEY = 'MS6b2d6d7d3fb64d30960c9856197a9f83'
ENDPOINT = 'https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro'
OUT = r'<images-folder>'
HEADERS = {'x-magnific-api-key': API_KEY, 'Content-Type': 'application/json'}

# Load and verify prompts are ≤ 2995 chars each
for name in ['descent-3x3', 'descent-gaps-3x3']:
    prompt = open(os.path.join(OUT, f'{name}.claude-img.txt'), encoding='utf-8').read()
    assert len(prompt) <= 2995, f'{name}: {len(prompt)} chars (over 2995)'
    r = requests.post(ENDPOINT, json={'prompt': prompt, 'resolution': '2K'}, headers=HEADERS)
    data = r.json()
    # CRITICAL: task_id is nested under "data" key
    tid = (data.get('data') or data).get('task_id')
    # ... poll every 5s, status from resp['data']['status']
    # On COMPLETED: download resp['data']['generated'][0] — generated is a list of strings (direct URLs)
```

### 7d — Magnific API gotchas for agents (READ BEFORE GENERATING)

Seven roadblocks that have cost hours. Do NOT regress on any of them.

| # | Gotcha | Symptom | Fix |
|---|--------|---------|-----|
| **1** | **task_id nested under `data`** | `task_id: None`, then 400s on polling | Extract as: `(resp.get('data') or resp).get('task_id')` |
| **2** | **Subagent shell delegation hangs** | Shell subagent runs 600s+ with no output | Use direct Python script with `block_until_ms: 600000` |
| **3** | **Generic "cinematic" style block** | Flat renders, no warm/cool tension, pure black shadows | Use the Naughty Dog / Uncharted 4 cinematic CGI block from medical-mechanism-image-prompting skill — cool blue-gray dominant, warm focal accents, volumetric haze |
| **4** | **Prompt > 2995 chars** | Silent API failure or truncated output | Compress panel descriptions; NEVER trim the Naughty Dog style opener or closing "no text anywhere" line |
| **5** | **Status also nested under `data`** | Poll loop hangs on `IN_PROGRESS` even when done | Check `(resp.get('data') or resp).get('status')` |
| **6** | **`generated` is list of strings, not dicts** | `KeyError: 'url'` or `None` when accessing `generated[0]['url']` | `generated[0]` IS the URL — a string, not a dict. Do NOT chain `.url` |
| **7** | **Text-only prompt — no visual reference attached** | Renders ignore the Naughty Dog style description, produce flat generic game art | Encode `uncharted-4-main-menu.png` as **raw base64** (NOT data URL prefix), include in `reference_images` array: `{'image': raw_b64, 'mime_type': 'image/png'}` |
| **8** | **Missing `mime_type` on reference_image** | `400 Validation error: "Field required"` | Add `'mime_type': 'image/png'` to each reference_images entry — e.g. `{'image': raw_b64, 'mime_type': 'image/png'}` |
| **9** | **Wrong polling URL** | Status always empty, times out after 600s | Poll at `f'{ENDPOINT}/{task_id}'`, NOT at `f'https://api.magnific.com/v1/ai/tasks/{task_id}'` — the tasks endpoint doesn't exist

### 7e — Reference

See `C:\Users\steve\MeWorld\dev\screenshots\crohns-anal-tags-2026-07-23\images\descent-3x3.png` for the gold standard output.

## Step 8 — Update case-sequence.json

After generating images, update the `images` section:

```json
{
  "images": {
    "descent3x3": {"status": "complete", "path": "images/descent-3x3.png", "size": "5.8 MB", "model": "nano-banana-pro", "resolution": "2K", "style": "Naughty Dog / Uncharted 4 cinematic CGI"},
    "descentGaps": {"status": "complete", "path": "images/descent-gaps-3x3.png", "size": "5.7 MB", "model": "nano-banana-pro", "resolution": "2K", "style": "Naughty Dog / Uncharted 4 cinematic CGI"}
  }
}
```

### Second attempt handling

If Steve replays a case and a second score report comes in, add a `secondAttempt` block to `case-sequence.json` rather than overwriting the original:

```json
{
  "secondAttempt": {
    "score": "87.71%",
    "diagnosisOrders": "80%",
    "treatmentOrders": "90.48%",
    "whatImproved": "Ordered CT surgery consult (the critical miss from attempt 1), added IV opioids, zero negative updates"
  }
}
```

Also append a "## Second Attempt" section to the README documenting what changed.

## Tell Steve

When complete, report:
- Dossier path
- Screenshot count
- Missing orders count with one-line mechanisms
- "Image generation running in background — N panels in <images/> folder"

## Reference dossiers

- `C:\Users\steve\MeWorld\dev\screenshots\crohns-anal-tags-2026-07-23\` — first case, full pipeline
