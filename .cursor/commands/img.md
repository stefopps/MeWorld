---
name: img
description: Generate a single still image using Magnific REST API (primary) or Higgsfield MCP (fallback). Always attaches MeWorld style refs when relevant.
---

# /img

Generate a still image using Magnific REST API — Steve's `MAGNIFIC_API_KEY` from `master.env` / `game/.env`. One retry per backend, then switch.

## Usage

```
/img a 16:9 2k image of a Ghanaian market scene at golden hour, warm tones
/img portrait of a middle-aged Black doctor in a white coat, ED lighting
/img 9:16 character map, Black lady with cornrows, neutral white background
/img cinematic wide shot of an international airport terminal at night, overhead security perspective...
```

## Agent workflow

### 1. Check API key

```powershell
Set-Location "C:\Users\steve\MeWorld\game"
node -e "require('dotenv').config(); const k=process.env.MAGNIFIC_API_KEY; if(!k||k.length<10){console.log('MISSING');process.exit(1)}else{console.log('OK — length '+k.length)}"
```

If missing, load from `C:\Users\steve\.cursor\master.env` or `game/.env`.

### 2. Parse the prompt

From user's message, extract:
- **Subject** — what/who
- **Aspect ratio** — default `16:9` (`9:16`, `1:1`, `4:3` also supported)
- **Style / mood** — lighting, palette, atmosphere
- **Is this a MeWorld scene?** — hospital ED, patient, character map, or game-related

### 3. ATTACH STYLE REFERENCES (mandatory for MeWorld scenes)

**Every MeWorld-related generation MUST attach these references.** If the image is NOT a MeWorld scene, skip this step.

#### 3a. Read and embed the style lock prompt

Read these files and embed their text into the prompt:

| File | Path |
|------|------|
| **Camera lock** | `C:\Users\steve\MeWorld\game\game\dev\scene-camera-lock\prompts\magnific-camera-lock.txt` |
| **Game engine stylization pass** | `C:\Users\steve\MeWorld\game\game\dev\uber-portrait-refs\prompts\game-engine-stylization-pass.txt` |

Append to the user's prompt:
```
This is a MeWorld game engine still. GENRE: Cinematic hospital film-still CGI — tactile sculptural stylized clinical realism, muted cool palette (blues, greys, sterile whites). Naughty Dog / cinematic game-engine render quality. Smooth 3D sculptural CGI surfaces with ambient occlusion, soft global illumination, subsurface scattering on skin, tactile fabric. NO line art, NO comic strokes, NO tilt-shift miniature, NO photoreal DSLR headswap, NO stock-photo polish. MANDATORY: match the sculptural 3D CGI render family exactly.
```

#### 3b. Attach reference images as base64 (if on disk)

Check these paths and base64-encode any that exist:

| Priority | Path | Role |
|----------|------|------|
| 1 | `C:\Users\steve\MeWorld\game\game\dev\scene-camera-lock\references\case-154-camera-lock-gold.png` | Canonical camera angle lock |
| 2 | `C:\Users\steve\MeWorld\game\game\dev\anatomic-plates\raw\male-ed-anatomic-plate-a.png` | Crop framing lock (male) |
| 3 | `C:\Users\steve\MeWorld\game\public\assets\patient\patient-scene.png` | Male play baseplate (1536x864) |
| 4 | `C:\Users\steve\MeWorld\game\public\assets\patient\patient-scene-female.png` | Female play baseplate (2048x1152) |

Only attach images that actually exist on disk. Skip any that don't.

```javascript
const fs = require('fs');
const refs = [];
const paths = [
  'C:/Users/steve/MeWorld/game/game/dev/scene-camera-lock/references/case-154-camera-lock-gold.png',
  'C:/Users/steve/MeWorld/game/game/dev/anatomic-plates/raw/male-ed-anatomic-plate-a.png',
  'C:/Users/steve/MeWorld/game/public/assets/patient/patient-scene.png',
];
for (const p of paths) {
  if (fs.existsSync(p)) {
    refs.push({ type: "image", image: fs.readFileSync(p).toString('base64') });
    console.log('Attached:', p.split('/').pop());
  }
}
```

### 4. Build the final prompt

Combine user's description + style lock (if MeWorld) + camera lock (if MeWorld scene):

```
[User's original prompt]

[Style lock text from step 3a]

CAMERA LOCK: [from magnific-camera-lock.txt if MeWorld scene]
```

### 5. Generate (Magnific REST)

```javascript
const body = {
  prompt: finalPrompt,
  aspectRatio: "16:9",  // or as specified
  resolution: "2K",     // CAPITAL K — never lowercase
  count: 2
};
if (refs.length) body.references = refs;

const key = process.env.MAGNIFIC_API_KEY;
const r = await fetch('https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro', {
  method: 'POST',
  headers: { 'x-magnific-api-key': key, 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

const created = await r.json();
const taskId = created?.data?.task_id || created?.task_id;
console.log('Task:', taskId);
```

### 6. Poll until complete

Poll every 2.5s, up to 180s:

```javascript
const poll = await fetch(`https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro/${taskId}`, {
  headers: { 'x-magnific-api-key': key }
});
const payload = await poll.json();
const data = payload?.data || payload;
// On COMPLETED: data.generated[0] has the URL
```

### 7. Download and save (MANDATORY — always save locally)

| Context | Save path |
|---------|-----------|
| **MeWorld portraits** | `C:\Users\steve\MeWorld\game\.case-portraits\case_NNN.png` |
| **MeWorld scenes / metaphors** | `C:\Users\steve\MeWorld\game\study\biostats-mastery\assets\images\<name>.png` |
| **Talking Images** | `M:\Works\Houdini Projects\TheMind_KOS\resources\talking-images\characters\<slug>\stills\<name>.png` |
| **Generic / inbox** | `C:\Users\steve\Pictures\Cursor-Vision-Inbox\<descriptive-name>.png` |

Download the image:
```javascript
const imgR = await fetch(url);
const buf = Buffer.from(await imgR.arrayBuffer());
fs.writeFileSync(outPath, buf);
console.log('Saved:', outPath, '(' + (buf.length / 1024).toFixed(0) + ' KB)');
```

### 8. Open the folder (MANDATORY after every generation)

```powershell
explorer /select,"<full-path-to-saved-file>"
```

This opens File Explorer with the file selected so Steve can review it immediately.

### 9. Fallback — Higgsfield MCP

If Magnific REST fails (auth, credits, timeout):
- Switch to **Higgsfield MCP** `generate_image` on `plugin-higgsfield-higgsfield`
- Model: `nano_banana_pro`, resolution: `2k`, same aspect, same prompt (with style lock text)
- One retry only — do not loop
- Still download and open the folder on success

### 10. Tell Steve

Show the file path, file size, and any notes about quality. Mention which style refs were attached.

## Defaults

| Param | Default |
|-------|---------|
| Model | `nano-banana-pro` |
| `aspectRatio` | `16:9` |
| `resolution` | `2K` (capital K) |
| `count` | `2` |
| Poll timeout | 180s |

## After generation — mandatory

- [ ] Image downloaded to local disk
- [ ] `explorer /select,"<path>"` opened for Steve to review
- [ ] File size and path reported
- [ ] Style refs attached listed (or "none — not a MeWorld scene")

## Do not

- Use Magnific MCP OAuth — this key is REST
- Use Fal — expired
- Skip `resolution: "2K"` (it is case-sensitive — `"2k"` fails)
- Use Magnific for video — ComfyUI only
- Skip the MeWorld style lock for MeWorld scenes
- Skip downloading and opening the folder
