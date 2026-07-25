# Magnific Image Generation — Agent Handoff

**Working recipe for 3x3 treatment plates via Magnific nano-banana-pro.**

---

## Prerequisites

- Python 3 with `requests` library
- Magnific API key
- Prompt text files (`.claude-img.txt`) already written in the case dossier `images/` folder

---

## The script

Save as `_gen.py` in the `images/` folder. The prompt files and output PNGs must be in the same directory.

```python
import requests, time, os, json, base64

API_KEY = 'MS6b2d6d7d3fb64d30960c9856197a9f83'
TASK_PATH = '/v1/ai/text-to-image/nano-banana-pro'
CREATE_URL = f'https://api.magnific.com{TASK_PATH}'
OUTDIR = os.path.dirname(os.path.abspath(__file__))

# MANDATORY: Attach the approved Naughty Dog visual reference
REF_PATH = r"C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png"
with open(REF_PATH, "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode("ascii")
REF_DATA_URL = f"data:image/png;base64,{ref_b64}"
REF_IMAGE = {
    "image": REF_DATA_URL,
    "mime_type": "image/png",
    "text": "Match this exact visual style, lighting, color palette, and atmosphere. Cool blue-gray dominant ambient, warm amber focal accents, volumetric haze, lived-in worn surfaces, soft vignette."
}

pairs = [
    ('descent-3x3.claude-img.txt', 'descent-3x3.png'),
    ('descent-gaps-3x3.claude-img.txt', 'descent-gaps-3x3.png'),
]

HEADERS = {
    'x-magnific-api-key': API_KEY,
    'Content-Type': 'application/json',
}

for prompt_file, out_name in pairs:
    prompt_path = os.path.join(OUTDIR, prompt_file)
    with open(prompt_path, 'r', encoding='utf-8', errors='replace') as f:
        prompt_text = f.read().strip()
    print(f'[SUBMIT] {prompt_file} ({len(prompt_text)} chars)', flush=True)

    payload = {
        'prompt': prompt_text,
        'aspect_ratio': '16:9',
        'resolution': '2K',
        'num_outputs': 1,
        'reference_images': [REF_IMAGE],
        'negative_prompt': 'text overlay, lettering, captions, subtitles, cartoon, anime, 2D flat, plastic skin, overexposed, blurry',
    }

    r = requests.post(CREATE_URL, json=payload, headers=HEADERS, timeout=30)
    created = r.json()
    task_id = (created.get('data') or {}).get('task_id') or created.get('task_id')
    if not task_id:
        print(f'  ERROR: No task_id — {json.dumps(created)[:400]}', flush=True)
        continue
    print(f'  task_id={task_id}', flush=True)

    POLL_URL = f'{CREATE_URL}/{task_id}'
    for i in range(80):
        time.sleep(3)
        sr = requests.get(POLL_URL, headers={'x-magnific-api-key': API_KEY}, timeout=15)
        sd = sr.json()
        data = sd.get('data') or sd
        status = str(data.get('status', '')).upper()
        print(f'  poll {i+1}: {status}', flush=True)

        if status == 'COMPLETED':
            urls = data.get('generated') or data.get('result', {}).get('url') or []
            if isinstance(urls, list) and urls:
                url = urls[0]
            elif isinstance(urls, str):
                url = urls
            else:
                url = data.get('url') or data.get('result', {}).get('url')
            if url:
                print(f'  downloading...', flush=True)
                ir = requests.get(url, timeout=60)
                out_path = os.path.join(OUTDIR, out_name)
                with open(out_path, 'wb') as f:
                    f.write(ir.content)
                print(f'  SAVED {out_path} ({len(ir.content)} bytes)', flush=True)
            break
        elif status == 'FAILED':
            print(f'  FAILED: {json.dumps(sd)[:400]}', flush=True)
            break
    else:
        print(f'  TIMEOUT after 80 polls', flush=True)
print('DONE', flush=True)
```

## Run

```powershell
python "C:\Users\steve\MeWorld\dev\screenshots\<case-folder>\images\_gen.py"
```

Typical runtime: 60–120 seconds for two plates.

---

## Three bugs that kill earlier runs

### 1. Poll URL is wrong

The poll endpoint is **NOT** `https://api.magnific.com/v1/tasks/{task_id}`.

It is `https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro/{task_id}` — the **same path as creation**, with `/{task_id}` appended.

```python
# Wrong — returns 404 "Not found"
POLL_URL = f'https://api.magnific.com/v1/tasks/{task_id}'

# Correct
POLL_URL = f'{CREATE_URL}/{task_id}'
```

### 2. Status is case-sensitive

Magnific returns `"COMPLETED"` (uppercase), not `"completed"` (lowercase). Must call `.upper()` before comparing.

```python
# Wrong — never matches
if status == 'completed':

# Correct
status = str(data.get('status', '')).upper()
if status == 'COMPLETED':
```

### 3. Inline Python in Shell silently buffers

`python -c "..."` in PowerShell never flushes stdout until the process exits. For a script that runs 60+ seconds, you see no output and can't tell if it's working.

**Fix:** Write a `.py` file, run it as `python _gen.py`, and use `flush=True` on every print.

```python
print(f'  poll {i+1}: {status}', flush=True)
```

### 4. Text-only prompts cannot match the visual style — reference image REQUIRED

Describing "Naughty Dog cinematic CGI" in text will produce generic high-end renders with no color temperature. The model needs to SEE the reference.

**Fix:** Always encode `uncharted-4-main-menu.png` as base64 data URL and include in `reference_images` array of every payload. The script template above includes this by default. Do NOT omit it.

---

## Prompt constraints

- **Max prompt length:** 2995 characters. The `magnificImage.js` server module trims at 2990.
- **Style block must come first:** The Naughty Dog / Uncharted 4 cinematic CGI style description is the most impactful part of the prompt. Never trim the style block to save space.
- **Negative prompt:** Always include: `'text overlay, lettering, captions, subtitles, cartoon, anime, 2D flat, plastic skin, overexposed, blurry'`
- **Aspect ratio:** `16:9` for treatment plates.
- **Resolution:** `2K`.

---

## Response shape

### Creation

```json
{
  "data": {
    "task_id": "07854e3b-46b3-48ee-a159-6f17ad482f1a"
  }
}
```

Note: `task_id` is nested under `data`. Use the fallback pattern:
```python
task_id = (created.get('data') or {}).get('task_id') or created.get('task_id')
```

### Polling

```json
{
  "data": {
    "status": "COMPLETED",
    "generated": ["https://..."],
    ...
  }
}
```

`status` is under `data`. `generated` is an array of URLs (one per `num_outputs`).

### Download

The result URL is a direct image download. Use `requests.get(url)` and write bytes to disk.

---

## File layout per case dossier

```
dev/screenshots/<case-slug>-YYYY-MM-DD/
  images/
    descent-3x3.claude-img.txt   ← prompt file
    descent-gaps-3x3.claude-img.txt  ← prompt file
    _gen.py                      ← this script
    descent-3x3.png              ← output (generated)
    descent-gaps-3x3.png         ← output (generated)
```

---

## Sizes to expect

| Model | Resolution | Typical file size |
|-------|-----------|-------------------|
| nano-banana-pro | 2K | 5.5–6.5 MB per 3x3 plate |
