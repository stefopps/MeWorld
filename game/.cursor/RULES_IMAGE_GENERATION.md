# MeWorld / Schoonmaker — image generation rules (all agents)

**Read this before any still-image generate, case portrait regen, anatomic plate, character map, or scene-element plate.**

| | |
|---|---|
| **Workspace** | `C:\Users\steve\MeWorld\game` |
| **API key location** | **`docs/WHERE_IS_THE_API.md`** — `master.env` + `game/.env` (Steve already provisioned) |
| **This file** | `.cursor/RULES_IMAGE_GENERATION.md` (canonical — start here) |
| **Platform** | **Magnific MCP** (`user-Magnific`) — primary for all stills |
| **Magnific app** | https://www.magnific.com/app — login, credits, **Connect** agent/MCP |
| **Fallback stills** | **Higgsfield** `nano_banana_pro` @ **`resolution: "2k"`** — only if Magnific fails or misses brief |
| **Global Cursor policy** | `C:\Users\steve\.cursor\rules\steve-generation-access.mdc` |
| **Kojo parity handoff** | `M:\Works\Houdini Projects\TheMind_KOS\resources\talking-images\characters\kojo-oppong\AGENT_HANDOFF-2026-06-09-EAGLE-STYLE.md` |

**Anatomy & biochem references:** `dev/references/REFERENCE_INDEX.md` → fast-lookup index for FirstAid-Step1-2025-35th.pdf (865pp) + Netter-Atlas-Human-Anatomy-7e.pdf. Use this before generating any anatomy/science-based imagery — research real structure first, never invent from imagination.

**Video is separate:** ComfyUI MCP only — see `comfyui-video.mdc`. Do not use Magnific or Higgsfield for MeWorld video.

---

## Copy-paste prompt (next agent)

```
MeWorld Schoonmaker image generation:
Read game/.cursor/RULES_IMAGE_GENERATION.md
API: Steve's MAGNIFIC_API_KEY is already in ~/.cursor/master.env (and/or game/.env) — do NOT ask Steve to re-enter. Sanity: npm run verify:magnific
REST replay (same as prior agents): server/magnificImage.js via npm run gen:* scripts below — not MCP OAuth
RESEARCH FIRST: dev/scene-elements/SCENE_ELEMENT_REGISTRY.json — manufacturer URL or approved asset before any prop/device gen
Platform: Magnific REST for batch scripts · Magnific MCP (images_generate) for one-off portrait A/B in Cursor
Magnific MCP is CONFIRMED WORKING (2026-07-14). Auth: user-magnific OAuth. Wait for serverStatus: "ready".
Upload locals (MCP only): creations_request_upload → PUT bytes via Node → creations_finalize_upload → use returned identifier
Refs: scene/crop lock PNG + identity map (never text-only); pediatric = NO anatomy overlay ref
Generate (MCP): images_generate { mode: "imagen-nano-banana-2", aspectRatio: "16:9", resolution: "2K", count: 2, references: [...] }
Note: It's `mode`, NOT `model`. Slug is `imagen-nano-banana-2` (Nano Banana Pro — SOTA).
Post: creations_wait → download → fitToBaseplate (1536×864) → .case-portraits/case_NNN.png
Camera lock: crown→toes, monitor upper-right, IV upper-left — never face-only crop
```

---

## REST API replay — other agents (key already on machine)

Steve has already provisioned Magnific REST. **Do not ask for a new key** unless `npm run verify:magnific` fails.

| Step | Command |
|------|---------|
| **Confirm key loads** | `cd C:\Users\steve\MeWorld\game` then `npm run verify:magnific` |
| **Env load order** | `server/loadMasterEnv.js` → `C:\Users\steve\.cursor\master.env`, then `game/.env` |
| **Shared client** | `server/magnificImage.js` — `generateImageEditWithMagnific()` (inline base64 refs; Magnific cannot fetch localhost) |

**Same API runs any agent can repeat** (outputs land in `*-pending/` until Steve approves):

| Pipeline | npm / node | Pending output | Handoff doc |
|----------|------------|----------------|-------------|
| Uber identity maps | `npm run gen:uber-maps` | `dev/uber-portrait-refs/character-maps-pending/` | `dev/uber-portrait-refs/README.md` |
| Uber game scenes | `npm run gen:uber-scenes` | `dev/uber-portrait-refs/game-scenes-pending/` | `dev/uber-portrait-refs/GAME_SCENE_CAMERA_LOCK.md` |
| **Uber game scene — identity swap (preferred when gold is male)** | `node scripts/generate-uber-game-scene-idswap.mjs --slug=<slug> --force` | `game-scenes-pending/<slug>-GAME-SCENE-alt*-idswap-*.png` | § Step 2b below |
| Ship approved uber scenes | `npm run ship:uber-scenes` | `public/assets/patient/uber/*-GAME-SCENE.png` | `dev/uber-portrait-refs/WIRED_UBER_CASES.md` |
| Pediatric character maps | `npm run gen:ped-maps` | `dev/pediatric-portrait-refs/character-maps-pending/` | `dev/pediatric-portrait-refs/README.md` |
| Case story plates | `npm run gen:case-story -- 051` | `.case-story-cache/` | `dev/case-story/README.md` |
| TV presenter stills | `npm run process:tv-presentations` | `dev/tv-presentations/processed/beiza-tv/pending-approval/` | `dev/tv-presentations/AGENT_HANDOFF_TV_PRESENTATION.md` |
| TV broadcast degrade | `npm run tv:degrade` | same folder `*-tvfeed.png` | same |

**Flags (pass through to node scripts):**

```powershell
node scripts/generate-uber-game-scenes.mjs --only=vitiligo-wink-diastema
node scripts/generate-uber-game-scenes.mjs --regen-lock
node scripts/generate-ped-character-maps.mjs --only=skeptical
node scripts/generate-case-story-images.mjs 051 --force
node scripts/process-tv-presentations.mjs --force --degrade
```

**MCP vs REST:** Cursor MCP OAuth (`user-Magnific`) is for interactive portrait A/B in chat. **Batch scripts above always use REST** — the same path Steve already ran successfully. If REST 403, plan may lack Business API — fall back to MCP for that beat only.

---

## 0. Research first — mandatory (anti-slop)

**Before generating any image that includes medical equipment, furniture, or devices**, look up a **real product** — do not invent hardware from prompt text alone.

| Step | Action |
|------|--------|
| 1 | Open **`dev/scene-elements/SCENE_ELEMENT_REGISTRY.json`** — find the element `id` (monitor, IV pole, stretcher, O2 mask, catheter, gown, …) |
| 2 | Read `realWorld.manufacturer` / `productLine` / `catalogHint` |
| 3 | Visit **`referenceSearch.web`** (manufacturer catalog) or save Pinterest refs to `dev/scene-elements/sources/<id>/` + `NOTES.md` with URL |
| 4 | If `approvedLayer.path` or `characterMap.status: "approved"` exists — **use that asset**; do not regen the prop inline |
| 5 | Device-specific plates: **`dev/medical-element-plates/MEDICAL_ELEMENT_PLATES.json`** (e.g. Hudson RCI HUD1040 O2, BD Insyte IV) |

**Search order (never skip):**

1. Approved layer in registry  
2. In-game baseplate / character map already baked in scene  
3. `dev/medical-element-plates/raw/manifest.json`  
4. Pinterest → `dev/scene-elements/sources/<id>/`  
5. **Manufacturer website** → download ref → Magnific upload or `stock_to_creation`  

**Audit missing refs:**

```powershell
node scripts/audit-scene-element-registry.mjs
```

**Rule file (detail):** `.cursor/rules/scene-element-reference-lock.mdc`  
**Do not:** fantasy monitors, wooden IV poles, double O2 tubes, dorsal IV, home furniture, props without a product ref on file.

Portrait gens **inherit** approved scene hardware from the ED baseplate (`patient-scene*.png`) — research applies when creating **new** element maps or replacing baked props, not when swapping patient identity on an approved plate.

---

## 1. Visual signature (never drift)

MeWorld Play patient scenes are **training plates**, not stock hospital photography.

| Element | Rule |
|---------|------|
| **Genre** | Cinematic hospital **film-still CGI** — tactile sculptural stylized realism |
| **Palette** | Muted clinical — cool overhead key, soft fill, balanced gown/skin exposure |
| **NOT** | Photoreal live-action headswap, plastic AI skin, bright Pixar, OR dove camera, CCTV zoom |
| **Camera** | High overhead bedside ~**38°** from vertical, foot→head, **16:9** — **never 90° bird's-eye** |
| **Anatomy** | **Mandatory** `dev/anatomic-plates/prompts/anatomy-composition-lock.txt` on every portrait/baseplate gen |
| **Framing** | Patient supine **crown through toes** — bare feet at **foot of bed**, pointing along mattress (not at camera) |
| **Environment** | Lived-in ED game plate — linen wear, scuffs, cable clutter — not sterile showroom |
| **Scene anchors** | Both bed rails · vitals monitor **upper-right** · IV pole **upper-left** |
| **Gown** | Light blue short-sleeve hospital gown unless case brief overrides |
| **Identity change only** | Demographics, distress, hair, cables/mask/IV attachments — **never** camera, bed layout, or room geometry |

### Never invent

- Eye-level portrait or tight face close-up
- **90° direct overhead / bird's-eye** (feet point at camera — anatomically wrong)
- Mid-thigh-only crop (legacy — forbidden since 2026-06-16)
- Dutch angle, poster hero framing, new room layout
- Adult manikin body with a child face (pediatric cases)
- Colored anatomy zone overlays on shipped play assets (green/red paint is Photoshop offline only)
- Fal.ai, OpenAI `gpt-image-1` edits, Adobe cloud generative, localhost URLs as Magnific refs

### Banned cached portraits (Steve 2026-06-19)

**Do not serve or reuse** IDs in `server/bannedCasePortraits.js` — see `dev/case-portraits/BANNED.md`.

```powershell
node scripts/purge-banned-case-portraits.mjs
node scripts/audit-portrait-assets.mjs
```

`readPortraitCache()` treats banned IDs as **missing** → forces regen only after Steve removes the ban and wires uber GAME-SCENE / CHARACTER-MAP.

**`*_mask.png`:** compositing alpha (base vs IV pixel diff) — not clinical O₂ mask. Purge with base/iv when banning.

---

## 2. Approved assets (attach every run)

### Scene / camera lock

| Role | Path | Pixels | When |
|------|------|--------|------|
| **The 154 Angle (canonical)** | `dev/scene-camera-lock/references/case-154-camera-lock-gold.png` | 16:9 2k | **PRIMARY** — when Steve says "154 angle" or "use the 154 camera lock" |
| **Machine spec** | `dev/scene-camera-lock/SCENE_LOCK.json` | — | Read before every gen |
| **Male play baseplate** | `public/assets/patient/patient-scene.png` | 1536×864 | Runtime + layout ref |
| **Male crop lock (ALL adult gens)** | `dev/anatomic-plates/raw/male-ed-anatomic-plate-a.png` | 2752×1536 | Adult male **and female** Magnific layout ref — **never** `patient-scene-female.png` for gen input (POV feet artifact) |
| **Female play baseplate** | `public/assets/patient/patient-scene-female.png` | 2048×1152 → crop 1536×864 | Runtime display only — **not** Magnific layout lock |
| **Camera prompt** | `dev/scene-camera-lock/prompts/magnific-camera-lock.txt` | — | Paste into every prompt |

### Anatomy scope (adult baseplate gens only — see §6 pediatric)

| Role | Path | Notes |
|------|------|--------|
| Male anatomy overlay | `dev/anatomic-plates/raw/male-ed-anatomic-plate-anatomy.png` | IV portal scope — **triggers NSFW filter with child prompts** |
| Female anatomy overlay | `dev/anatomic-plates/raw/female-ed-anatomic-plate-anatomy.png` | Same |
| IV portal spec | `dev/anatomic-plates/IV_ACCESS_PORTALS.json` | Red/green zone semantics |
| Male plate prompt | `dev/anatomic-plates/prompts/male-ed-anatomic-plate.txt` | Clean plate gen |
| Female plate prompt | `dev/anatomic-plates/prompts/female-ed-anatomic-plate.txt` | Clean plate gen |
| Pediatric plate prompt | `dev/anatomic-plates/prompts/ped-male-ed-anatomic-plate.txt` | Child body scale |

### Identity maps

| Role | Path | Notes |
|------|------|--------|
| Lady registry | `src/data/patientLadyRefs.json` | Case slug → likeness |
| Lady maps | `public/assets/patient/ladies/*-CHARACTER-MAP.png` | **9:16 likeness only** — scene stays 16:9 |
| Magnific library lady | `akosuaduku` (character id **1870701**) | When already in library |
| Pediatric registry | `src/data/patientPediatricRefs.json` | Cases `054`, `089`, … |
| Kojo face lock (ped male) | `M:\Works\Houdini Projects\TheMind_KOS\resources\talking-images\characters\kojo-oppong\references\kojo-face-likeness-lock.png` | ~24 MB — upload as PNG |

### Scene elements (anti-slop)

| Role | Path |
|------|------|
| Element registry | `dev/scene-elements/SCENE_ELEMENT_REGISTRY.json` |
| Medical device plates | `dev/medical-element-plates/` |
| Runtime loader | `src/lib/sceneElementRegistry.js` |

Do not re-invent monitor/IV/bed hardware if registry has `status: "approved"`.

---

## 3. Platform & tools

### Use (stills)

| Tool | When |
|------|------|
| **Magnific `images_generate`** | Case portraits, anatomic plates, character maps, element heroes |
| **Magnific `images_models_list`** | Confirm slug before queue |
| **Magnific `creations_wait`** | Poll job (max `timeoutSeconds: 25` per call — loop until terminal) |
| **Magnific `creations_show`** | Inline preview for Steve after generate |
| **`scripts/magnific-upload-put.mjs`** | PUT local PNG to presigned URL (preferred on Windows) |
| **`server/portraitFrame.js` `fitToBaseplate`** | Center crop/resize to **1536×864** |
| **Higgsfield `generate_image`** | Fallback — `nano_banana_pro`, **`resolution: "2k"`**, same refs |

**Default model:** `imagen-nano-banana-2` · **`aspectRatio: "16:9"`** · **`resolution: "2k"`** (never omit).

### Do not use (stills)

| Tool | Why |
|------|-----|
| **Fal.ai** | Expired — Steve policy |
| **OpenAI image edits** | Wrong backend / billing dead for this pipeline |
| **Magnific / Higgsfield video** | MeWorld video = ComfyUI only |
| **Adobe cloud generative** | Photoshop firewalled offline |
| **`http://127.0.0.1/...` refs** | Magnific cloud cannot fetch localhost |

### Runtime vs agent batch

| Context | Path |
|---------|------|
| **Batch scripts (uber, ped, TV, case story)** | **REST replay** — `npm run gen:*` · key from `master.env` / `game/.env` · see **§ REST API replay** above |
| **Cursor agents (one-off portrait A/B)** | Magnific MCP OAuth — no API key in chat |
| **Play Regenerate button** | `server/magnificImage.js` REST (same key as batch scripts) |
| **No REST key** | Agent MCP batch → write `.case-portraits/case_NNN.png` + `.json` |

---

## 4. Magnific workflow (follow exactly)

1. **Read MCP tool schema** before each call (`mcps/user-Magnific/tools/*.json` in Cursor project).
2. **Auth:** `user-Magnific` OAuth. **Web login:** https://www.magnific.com/app (credits + home **Connect** for agents). **Cursor:** Settings → MCP → Magnific → Disconnect/Connect → Reload Window → `library_list`.
3. **Upload locals (>25 MB = reject):**
   ```
   creations_request_upload (mimeType: image/png)
     → node scripts/magnific-upload-put.mjs <localPath> <directUploadUrl>
     → creations_finalize_upload (path or uploads batch)
   ```
   - Use **`curl.exe` PUT** or the Node script — **not** PowerShell `Invoke-WebRequest` on GCS signed URLs.
   - Stable public URL alternative: `creations_upload_image`.
4. **Generate:** `images_generate` with `references: [{ type, identifier }]`.
5. **Poll:** `creations_wait` — repeat until `allTerminal: true`.
6. **Download:** fetch `results.url` → save disk (URLs expire).
7. **Post-process:** `fitToBaseplate(buffer)` → ship to cache paths (§8).

### `references[]` order (never text-only)

| Priority | Type | Asset |
|----------|------|-------|
| 1 | `image` | Crop lock or play baseplate (layout + camera) |
| 2 | `image` | Anatomy scope overlay — **adult gens only** (§6) |
| 3 | `image` or `character` | Identity map (lady 9:16, Kojo face, library character) |
| 4 | Prompt | `buildPortraitPrompt()` + `magnific-camera-lock.txt` + case/ped blocks |

**`count: 2`** for A/B pick on portraits. One retry per backend, then switch to Higgsfield.

---

## 5. Generation workflows

### A. Per-case patient portrait (default)

**When:** New case, regen from Play, or agent batch pre-cache.

1. Build context: `buildCaseChatContext(caseData)` → `server/casePortrait.js` `buildPortraitPrompt()`.
2. Resolve baseplate: `readBaseplateBuffer(gameRoot, caseContext)` — male / female / pedMale per `portraitFrame.js`.
3. Upload refs per §4 + §6 (pediatric vs adult).
4. `images_generate` · 16:9 · 2k · count 2.
5. Steve picks → `fitToBaseplate` → save:
   - `docs/portrait-previews/case-{id}-*.png` (review)
   - `.case-portraits/case_{id}.png` + update `.case-portraits/case_{id}.json` (`provider: magnific`, demographics).

**CLI preview (server REST — needs `MAGNIFIC_API_KEY`):**

```powershell
cd C:\Users\steve\MeWorld\game
node scripts/preview-pediatric-portrait.mjs 089
```

Agents without REST key: run MCP workflow above manually.

### B. Anatomic IV baseplate (sex-specific)

**When:** New male/female clean plate for Zone Studio.

1. Read `IV_ACCESS_PORTALS.json` + `SCENE_LOCK.json`.
2. Upload: crop lock + anatomy overlay + identity (female: `akosuaduku`).
3. Prompt: `dev/anatomic-plates/prompts/*-ed-anatomic-plate.txt`.
4. Output **clean plate** — no colored overlays (Steve paints zones in Photoshop offline).
5. Center-crop to 1536×864 · promote to `public/assets/patient/` when zones align.

### C. Lady character map (9:16 likeness)

**When:** New Pinterest ref → register in `patientLadyRefs.json`.

**Style:** Photoreal contact sheet — **identity only**. Game portraits use stylized MeWorld CGI on 16:9 baseplates. **Read `dev/character-maps/CHARACTER_MAP_TO_GAME_STYLE.md`** before shipping maps or running portrait gens.

1. Save source → `dev/character-maps/sources/<slug>-REF.png`.
2. Magnific · **9:16** · 2k · upload Pinterest ref.
3. Ship → `public/assets/patient/ladies/<slug>-CHARACTER-MAP.png`.
4. Register `identityPrompt` + optional `caseSlugs` in JSON.

Portrait runtime still uses **16:9 ED baseplate** — map is face/hair/gown identity only.

### C2. Uber game scene — identity swap on gold base (Step 2b · Steve 2026-06-30)

**When to use:** `generate-uber-game-scenes.mjs --3d` uses `male-ed-anatomic-plate-a.png` as the Magnific **edit base**. That often drifts — wrong room (side window), wrong face, **male body on female characters** (vitiligo gold is a male patient).

**Fix:** Use an **approved GAME-SCENE gold** as the edit base; swap **identity + body only**.

| Input | Path |
|-------|------|
| Scene lock (base image) | `dev/uber-portrait-refs/game-scenes-pending/vitiligo-wink-diastema-GAME-SCENE-alt2.png` (default) |
| Identity | `public/assets/patient/uber/<slug>-CHARACTER-MAP.png` or `character-maps-pending/<slug>-CHARACTER-MAP-alt1.png` |
| Source photo | `dev/uber-portrait-refs/sources/<sourceFile>` |
| Registry | `src/data/patientUberRefs.json` → `identityPrompt`, `sex: female` |

```powershell
cd C:\Users\steve\MeWorld\game
npm run verify:magnific
node scripts/generate-uber-game-scene-idswap.mjs --slug=copper-twa-nose-stud
node scripts/generate-uber-game-scene-idswap.mjs --slug=copper-twa-nose-stud --gold=vitiligo-wink-diastema-GAME-SCENE-alt2.png --force
```

**Female patients on male gold:** prompt must include **feminine body block** — full bust under gown, curved waist, wider hips; **NOT** male vitiligo torso. Script adds this automatically when `sex: female` in `patientUberRefs.json`.

**Do not** use anatomic crop lock as base for this pass. **Do** keep vitiligo overhead angle, dark ED, crown→toes, toes on mattress.

Output: `*-GAME-SCENE-alt*-idswap-YYYYMMDD.png` in `game-scenes-pending/` — Steve approves → ship to `public/assets/patient/uber/<slug>-GAME-SCENE.png`.

### D. Scene element hero (anti-slop)

**When:** Registry entry lacks `approvedLayer.path` or `characterMap.status` is not `"approved"`.

**Prerequisite:** Complete **§0 Research first** — manufacturer catalog or saved product ref in `dev/scene-elements/sources/<id>/`.

1. Pinterest / **manufacturer product page** → save refs + URL in `NOTES.md`.
2. Magnific element map once → Photoshop offline retouch → register `SCENE_ELEMENT_REGISTRY.json`.
3. Subsequent portrait gens load approved layer — do not re-describe hardware in prompt.

Audit: `node scripts/audit-scene-element-registry.mjs`.

---

### Category / preview match (runtime)

When browsing **Pediatrics** in briefing picker or rendering a pediatric case:

1. `resolvePatientSceneKey()` → `pedMale` / `pedFemale` baseplate (`patient-scene-ped-*.png`).
2. `resolvePediatricPortraitRef()` — category pattern OR `patientPediatricRefs.json` case id.
3. Briefing picker **hover** previews that case's portrait + pediatric scene before Begin.
4. Never show adult `patient-scene.png` behind a pediatric list row or ped case id.

---

## 6. Pediatric portraits (mandatory differences)

Pediatric cases (`patientPediatricRefs.json`, `isPediatric: true`) require **child body scale** — not an adult manikin with a child face.

| Case | Age | Notes |
|------|-----|-------|
| `054` | newborn | Swaddled/gown, neonate proportions |
| `089` | ~6 years | Child-protection burns — **non-graphic** facial erythema only in gens |

### NSFW filter (learned 2026-06-18)

Magnific **rejects** pediatric gens when you attach:

- `*-anatomic-plate-anatomy.png` (exposed anatomy zones), **and/or**
- Prompts mentioning graphic burns, buttocks injury, nudity, or gore on a child

**Safe pediatric ref stack:**

| Sex | Layout ref | Identity ref | Avoid |
|-----|------------|--------------|-------|
| Male | `patient-scene.png` | `kojo-face-likeness-lock.png` | Anatomy overlay |
| Female | `patient-scene-female.png` | **Text-only** (braids, child proportions) | **Adult Daniella welcome plate + child prompt** (NSFW) |

Male: upload Kojo face lock. Female: use female scene lock only — describe school-age girl in prompt; do not upload adult character plates when the prompt says child.

**Safe prompt language:** fully clothed gown · subtle non-graphic erythema on cheeks · educational medical illustration · no gore · no nudity · child proportions (shorter limbs, smaller frame).

Gold prompt on disk: `docs/portrait-previews/case-089-magnific-prompt.txt`.

Update `patientPediatricRefs.json` prompts — never ship buttocks/graphic injury text to image APIs.

---

## 7. Prompt skeleton (case portrait)

```
Cinematic hospital film-still CGI. CAMERA LOCK: match reference scene layout exactly —
16:9 landscape, high overhead bedside view from foot of bed toward head (~38° from vertical),
patient supine centered crown through toes, bare feet at foot of bed (along mattress, not toward camera),
both bed rails visible, vitals monitor upper-right, IV pole upper-left, cool clinical overhead lighting.
Do NOT change camera angle, zoom, bed position, or room layout. NOT 90° bird's-eye overhead.

[PASTE anatomy-composition-lock.txt — mandatory every run]

Lived-in busy ED game environment — subtle wear, not sterile showroom.

[IDENTITY BLOCK — demographics, lady map, or pediatric scale from buildPortraitPrompt()]

Light blue short-sleeve hospital gown, forearms visible, NO peripheral IV unless case requires.
Tactile sculptural stylized realism, muted clinical palette — NOT photoreal live-action.
MeWorld Play medical training portrait. No text, watermarks, or extra people.
```

Append `SCENE ELEMENT LOCK` block from registry when elements are approved.

**Avoid in prompts:** masterpiece, epic, 8k hype without optical specifics, mid-thigh crop, eye-level portrait.

---

## 8. File naming & save locations

```
public/assets/patient/patient-scene.png              ← male play master (1536×864)
public/assets/patient/patient-scene-female.png      ← female play master
public/assets/patient/ladies/<slug>-CHARACTER-MAP.png
dev/anatomic-plates/raw/male-ed-anatomic-plate-a.png
dev/anatomic-plates/raw/*-anatomic-plate-anatomy.png
docs/portrait-previews/case-{id}-pediatric-preview.png   ← agent review
.case-portraits/case_{id}.png                        ← runtime cache (gitignored)
.case-portraits/case_{id}.json                       ← provider, persona, frame meta
```

| Action | Where |
|--------|--------|
| Agent review / A/B picks | `docs/portrait-previews/` |
| Play runtime cache | `.case-portraits/` |
| Promoted baseplates | `public/assets/patient/` |
| Anatomic work-in-progress | `dev/anatomic-plates/raw/` → `approved/` |
| Character map sources | `dev/character-maps/sources/` |

**Export frame:** `BASEPLATE_WIDTH=1536` · `BASEPLATE_HEIGHT=864` · `PORTRAIT_FRAME_VERSION=3` (`server/portraitFrame.js`).

---

## 8b. Storyboard grids (video prep — Steve approved 2026-06-30)

**Rule file:** `.cursor/rules/storyboard-grid-generation.mdc`  
**Style lock:** `dev/uber-portrait-refs/prompts/storyboard-grid-meworld-style-lock.txt` + `game-engine-stylization-pass.txt`  
**Gold plate:** `dev/uber-portrait-refs/video-pending/blue-hijab-body-testing-storyboard-2x4-8x9.png`  
**Script:** `scripts/gen-storyboard-grid-once.mjs` (Magnific `4:5` @ 4K → center-crop **8:9** → **3840×4320** via `sharp`)

| Param | Value |
|-------|--------|
| Layout | **2×4** (8 panels), thin black dividers, no text |
| Plate aspect | **8:9** — `(cols×16):(rows×9)` → each panel crops **16:9 @ 1920×1080** |
| Target size | **3840×4320** for 2×4; **3840×3240** for 2×3 |
| Magnific API | No native `8:9` — generate **`4:5` @ 4K**, center-crop to 8:9, resize to target (or Comfy/Flux at exact pixels) |
| Magnific `count` | **1 only** — grids already multi-angle; **no alt1/alt2** unless Steve rejects and asks regen |
| Style | MeWorld sculptural CGI on **all** panels (hospital + metaphor beats in same render family); NOT photoreal documentary |
| Narrative | Family conflict = **fear subtext**, not moral judgment of patient choices (Immersa voice standard) |

Output: `dev/uber-portrait-refs/video-pending/<slug>-<scene>-storyboard-2x4-8x9.png`

Exception to §9 A/B: **single-shot portraits** → count 2 OK; **storyboard grids** → count 1 always.

---

## 9. Review delivery (Steve)

1. **`creations_show`** after every `images_generate` — do not wait for full batch silently.
2. Run **A/B (count: 2)** on **single** portraits and character maps; pick winner before upscale or promote. **Storyboard grids: count 1** (§8b).
3. Open refs in vision context when describing picks.
4. On approval → `fitToBaseplate` → copy to `.case-portraits/` → set `provider: magnific` in JSON meta.
5. Validate scene lock before baseplate promote: `node scripts/validate-scene-lock.mjs`.

---

## 10. Success criteria

- [ ] Camera matches `SCENE_LOCK.json` — overhead ~38°, crown→toes, feet visible
- [ ] Monitor upper-right, IV upper-left, both rails visible
- [ ] Identity matches case demographics (adult vs pediatric scale correct)
- [ ] Sculptural clinical CGI — not adult manikin on child case
- [ ] Generated via Magnific MCP (or HF fallback) — not Fal, not OpenAI edits
- [ ] Saved at **1536×864** after `fitToBaseplate`
- [ ] `.case-portraits/case_{id}.json` updated (`provider`, `cachedAt`, `isPediatric` when applicable)
- [ ] Pediatric gens used safe ref stack (§6) — no anatomy overlay

---

## 11. Related docs (deeper detail — do not duplicate here)

| Doc | Use |
|-----|-----|
| **`.cursor/RULES_IMAGE_GENERATION.md`** | **This file — canonical** |
| `.cursor/rules/meworld-magnific-mcp.mdc` | Cursor glob rule → points here |
| `.cursor/rules/scene-camera-lock.mdc` | Camera lock enforcement |
| `.cursor/rules/patient-character-maps.mdc` | Lady 9:16 maps |
| `.cursor/rules/anatomic-iv-plates.mdc` | IV portal plates + Photoshop zones |
| `.cursor/rules/scene-element-reference-lock.mdc` | Prop registry anti-slop |
| `docs/components/PORTRAIT_RULES.md` | Portrait smoke + framing summary |
| `dev/scene-camera-lock/README.md` | SCENE_LOCK human-readable |
| `dev/anatomic-plates/README.md` | Anatomic plate pipeline |
| `dev/character-maps/CHARACTER_MAPS.md` | Lady map workflow |
| `dev/character-maps/CHARACTER_MAP_TO_GAME_STYLE.md` | **Two-step:** photoreal map → stylized game scene |
| `AGENTS.md` § Case portraits | Runtime API paths + UI |
| `server/casePortrait.js` | `buildPortraitPrompt()`, cache write |
| `server/magnificImage.js` | REST path for Play regen |

**BEIZA equivalent (different project):** `M:\Works\Houdini Projects\TheMind_KOS\adobe\Personal Brand\.cursor\RULES_IMAGE_GENERATION.md`

---

## 12. Process shot / multi-pass workflow (concept imagery, grids, metaphor plates)

For concept-metaphor images (anticoagulation dioramas, balloon expressions, PE saddle-embolus grids, etc.) — not per-case patient portraits:

### A. Concept-first pipeline (follow in order)

1. **Lock the single concept first.** State it in one sentence that would be wrong for any other question. If the request stacks multiple mechanisms, push back — don't silently mesh or prune.
2. **Research real-world visual reference** before generating any scientific/biological phenomenon. Don't invent a visual convention from imagination. Record findings.
3. **Generate candidates as separate images** (not a grid) when comparing unresolved concepts or styles. A composited grid is for a **locked final plate** only.
4. **Evaluate on two independent axes**: mechanism (does composition communicate the concept) and style (does rendering match house look). These can point to different candidates — merge explicitly, don't pick one wholesale.
5. **Refine individual elements against research** — state exactly what's wrong and why.
6. **Only once all three (mechanism, style, element detail) are confirmed**, produce the final plate — single hero or composited grid.
7. **Log new rules back**, so the next session starts updated.

### B. Exaggeration / caricature dial (4 passes — state pass number explicitly every time)

| Pass | Name | Defining traits |
|------|------|-----------------|
| 1 | **Grounded** | Realistic, dramatic but believable proportions |
| 2 | **In-engine cutscene extreme** | ~1.2–1.4x proportion push, top of what a rig could sell, sweat droplets, capillary detail |
| 3 | **Concept art exaggeration** | Genuinely caricatured — silhouette-first, head enlarged vs shoulders, asymmetric features, comedic volume, sacrifice some realism for readability |
| 4 | **Poster / key art maximum** | Full caricature — fisheye distortion, near-comic-book contrast, surreal proportions, instant graphic readability over any remaining realism |

**Never leave the pass ambiguous.** Every prompt that uses this dial must state `Pass N — [name] — [key traits]`.

### C. Prompts with the MeWorld house style

Every concept-image prompt must include the **MeWorld style lock block verbatim** — never paraphrase:

```
Cinematic hospital film-still CGI — MeWorld Play game engine still. Tactile sculptural stylized clinical realism, muted cool palette (blues, greys, sterile whites). Naughty Dog / cinematic game-engine render quality — photographic-game-engine hybrid. Smooth 3D sculptural CGI surfaces, ambient occlusion, soft global illumination, subtle subsurface scattering on skin. Stylized PBR game assets, muted clinical color grading, no neon saturation. NO photoreal live-action headswap, NO flat 2D illustration, NO bright Pixar, NO identity contact-sheet paste, NO over-sharpened AI plastic skin, NO wax doll finish, NO line art, NO strokes, NO comic, NO sketch lines, NO cel-shading.
```

**Magnific MCP `mode`:** `imagen-nano-banana-2` (Nano Banana Pro — the SOTA model). Do NOT use `model` — it's `mode`.

### D. Grid generation rules

- A "2×2 grid" = ONE single composited image plate with thin dark dividers, not 4 separate generations.
- **Side-by-side candidate evaluation** before locking = separate images. Final production plate = one image.
- **Multi-panel grids default to one unified environment** unless the concept needs a deliberate internal/external split (e.g., anatomical cutaway + patient).
- **Camera treatment must vary per panel** — no two adjacent panels share the same angle.
- **Dynamic POV is default for immersive single shots** — foreground element slightly out of focus, low wide-angle lens, shallow depth of field.

### E. Character identity on grids (learned 2026-07-14)

When a 2×2 grid mixes internal anatomy (top row) and a specific character face (bottom row), the character identity often **dilutes** — the model blends toward generic "patient." Fixes:

1. **Split into separate plates** — one 16:9 for internal/anatomy panels, one 16:9 for character panels. Composite later.
2. If one-plate is required: use **character ref as the ONLY image reference**, no competing style images, and weld the character identity lock into every panel's prompt block.

### F. Metaphor discipline

- One question, one concept, one metaphor per panel/grid.
- State the concept in one sentence that would be wrong for any other question.
- Keep the concept claim checkable against real medical source material.

### G. Structure/phenomenon rendering

When depicting a real physical/biological structure (clots, particles, anatomy), render it the way **real reference imagery** shows it — not whatever reads most visually dramatic by default.

*Example: an occlusive blood clot at a vessel bifurcation renders as a solid, dense, lobulated, rubbery, layered cast (matching gross-pathology/CT-angiography) — NOT a glowing mesh or web of strands.*

---

*End — image generation agents start here.*
