---
name: img-grid
description: Generate a 2×2 still image grid on one plate using Magnific REST API (primary) or Higgsfield MCP (fallback). Always attaches MeWorld style refs when relevant.
---

# /img-grid

Generate a 2×2 image grid on a single plate — four variations of the same subject in one image. Uses Magnific REST API (`MAGNIFIC_API_KEY`), Higgsfield MCP fallback.

## Usage

```
/img-grid 2x2 character contact sheet, Black lady with short natural hair, neutral white background, four head angles: front, 3/4 left, 3/4 right, profile
/img-grid 2x2 scene variants, ED room overhead, four lighting moods: morning, noon, evening, night
/img-grid 2x2 expression bank, Kojo Oppong: confident, thoughtful, smiling, serious
```

## Agent workflow

### 1. Check API key

Same as `/img` — verify `MAGNIFIC_API_KEY` from `game/.env`.

```powershell
Set-Location "C:\Users\steve\MeWorld\game"
node -e "require('dotenv').config(); const k=process.env.MAGNIFIC_API_KEY; if(!k||k.length<10){console.log('MISSING');process.exit(1)}else{console.log('OK — length '+k.length)}"
```

### 2. Parse grid specification

- **Subject** — what/who
- **Grid layout** — default 2×2
- **Panel variations** — what changes between panels
- **Style / mood**
- **Is this a MeWorld scene?** — character map, expression bank, or game-related

### 3. ATTACH STYLE REFERENCES (mandatory for MeWorld grids)

Same as `/img` step 3. Read and embed:

| File | Path |
|------|------|
| **Game engine stylization pass** | `C:\Users\steve\MeWorld\game\game\dev\uber-portrait-refs\prompts\game-engine-stylization-pass.txt` |

Attach base64 references if they exist on disk:

| Priority | Path | Role |
|----------|------|------|
| 1 | `C:\Users\steve\MeWorld\game\game\dev\scene-camera-lock\references\case-154-camera-lock-gold.png` | Canonical camera angle lock |
| 2 | `C:\Users\steve\MeWorld\game\game\dev\anatomic-plates\raw\male-ed-anatomic-plate-a.png` | Crop framing lock |

### 4. Build the grid prompt

Describe a single image containing a 2×2 grid with explicit spatial instructions:

```
A 2×2 grid on one plate. Four equal panels arranged two across, two down. Clean separation between panels.

Top-left: [variation 1]
Top-right: [variation 2]
Bottom-left: [variation 3]
Bottom-right: [variation 4]

Consistent lighting, same subject identity. Neutral background. No text or labels.
```

**Character contact sheet:**
```
2×2 contact sheet, four equal panels, neutral white background.
Panel 1 (top-left): front-facing portrait, direct eye contact
Panel 2 (top-right): 3/4 angle right
Panel 3 (bottom-left): 3/4 angle left
Panel 4 (bottom-right): profile right
Same person, same outfit, same lighting.
```

**Expression bank:**
```
2×2 expression grid, four equal panels, same person identical framing per panel.
Top-left: [expression 1]
Top-right: [expression 2]
Bottom-left: [expression 3]
Bottom-right: [expression 4]
Same lighting, same background.
```

**Scene variants:**
```
2×2 scene variant grid. Same camera angle and layout in every panel.
Top-left: [variant 1]
Top-right: [variant 2]
Bottom-left: [variant 3]
Bottom-right: [variant 4]
```

**For MeWorld character maps / grids — append the style lock:**
```
This is a MeWorld game engine still — 2×2 contact sheet. GENRE: Cinematic hospital film-still CGI. Tactile sculptural stylized clinical realism, muted cool palette. Naughty Dog / cinematic game-engine render quality. Smooth 3D sculptural CGI surfaces. NO line art, NO comic strokes, NO tilt-shift miniature. NO photoreal DSLR headswap. NO stock-photo polish. MANDATORY: match the sculptural 3D CGI render family exactly.
```

### 5. Generate (Magnific REST)

```javascript
const body = {
  prompt: finalGridPrompt,
  aspectRatio: "1:1",
  resolution: "2K",    // CAPITAL K
  count: 1             // grid is four-in-one
};
if (refs.length) body.references = refs;

const key = process.env.MAGNIFIC_API_KEY;
const r = await fetch('https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro', {
  method: 'POST',
  headers: { 'x-magnific-api-key': key, 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});
```

Poll every 2.5s, up to 180s, download on COMPLETED.

### 6. If panels don't separate

If AI merges panels into one blob:
1. Retry with stronger language: "Four SEPARATE panels with CLEAR borders. Do not blend."
2. Fallback: four individual `/img` calls → composite in Photoshop.

### 7. Download and save (MANDATORY)

| Context | Save path |
|---------|-----------|
| **MeWorld character maps** | `C:\Users\steve\MeWorld\game\dev\character-maps\pending\<name>.png` |
| **MeWorld expressions** | `C:\Users\steve\MeWorld\game\dev\character-maps\pending\<name>-expressions.png` |
| **Talking Images** | `M:\Works\...\talking-images\characters\<slug>\stills\<name>-grid.png` |
| **Generic / inbox** | `C:\Users\steve\Pictures\Cursor-Vision-Inbox\<descriptive-name>.png` |

### 8. Open the folder (MANDATORY)

```powershell
explorer /select,"<full-path-to-saved-file>"
```

### 9. Fallback — Higgsfield MCP

If Magnific REST fails: switch to **Higgsfield MCP** `generate_image`. One retry only. Still download and open folder.

## Defaults

| Param | Default |
|-------|---------|
| `aspectRatio` | `1:1` (square fits 2×2 best) |
| `resolution` | `2K` (capital K) |
| `count` | `1` |
| Model | `nano-banana-pro` |

## After generation — mandatory

- [ ] Image downloaded to local disk
- [ ] `explorer /select,"<path>"` opened for Steve to review
- [ ] File size and path reported
- [ ] Style refs attached listed
