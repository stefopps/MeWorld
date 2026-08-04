# Claude Handoff — CCS Question Bank Scrape

**Date:** 2026-07-12  
**Owner path:** `C:\Users\steve\MeWorld\step3\`  
**Organized bank:** `C:\Users\steve\MeWorld\step3\scrape-bank\`

---

## Mission (what was done)

Scraped the CCS Question Bank at **https://qb.ccscases.com/** with a Playwright loop scraper. Output is one JSON per 50-question block (last unused pack was 39 Qs).

**Do not re-scrape Unused** unless pool shows Unused > 0 again. Unused was drained (~40 → final 39-Q block).

---

## Where the data lives (organized)

```
scrape-bank/
├── CLAUDE-HANDOFF.md      ← this file
├── README.md
├── manifest.json          ← per-block stats + totals
├── unique-question-ids.txt
├── raw/                   ← ALL scrape JSON (canonical)
│   ├── scrape-playwright-output.json   # block 1
│   ├── scrape-playwright-block2.json
│   ├── …
│   └── scrape-playwright-block119.json
├── exports/
│   └── scrape-export/     ← junction → ../scrape-export (PNG extracts, partial)
├── recordings/            ← copy of handoff click timings
└── logs/
    └── pool-stats-log.jsonl
```

**Scripts / browser stay in** `C:\Users\steve\MeWorld\step3\` (not inside `scrape-bank`):

| Path | Role |
|------|------|
| `playwright-scrape-qb.js` | Main scraper |
| `handoff-auto.js` | End Block → Create Test → Begin Test |
| `roadblock-helper.js` / `qb-recover.js` | Login + stuck recovery |
| `pool-stats.js` | Unused/Omitted counters |
| `postprocess-batch.js` / `extract-scrape-images.js` | PNG extract → linked JSON |
| `check-uniqueness.js` | Unique ID audit |
| `WORKFLOW.md` | Full scrape workflow |
| `qb_browser_profile/` | Saved login (do not delete / do not commit) |
| `ccs_credentials.json` | Login (gitignored) |

---

## Totals (as of handoff)

| Metric | Value |
|--------|------:|
| Blocks saved | **119** (block 1 = `scrape-playwright-output.json`) |
| Unique question IDs | **4,868** |
| Question slots (with repeats) | **5,939** |
| Approx repeats across blocks | **1,071** |
| Last block | **119** — **39/39** reveals (final Unused remnant) |
| Pool (last known) | Unused ~0 · Omitted ~5643 · Correct 2 · Incorrect 1 |

Exact numbers: open `scrape-bank/manifest.json`.

---

## Avatar saga + recursive trajectory (IMPORTANT)

Framework file: **`scrape-bank/AVATAR-SAGA-FRAMEWORK.md`**  
Trajectory builder (Cursor): **`scrape-bank/TRAJECTORY-CURSOR-INSTRUCTIONS.md`**  
First-10-sets batch: **`scrape-bank/CURSOR-INSTRUCTIONS-FIRST-10-SETS.md`**

### Draft Sets 1–10 (ready for Master review)
- **Set 1 template:** `set-01-story-va.html` (from Downloads `spine-story-demo-v2.html`)
- **Sets 2–5 Pattern A / 6–10 Pattern B:** `set-0N-story-va.html` / `set-0N-story-vb.html`
- **Manifest:** `sets-manifest.md` (+ `sets-manifest.json`)
- **Regenerate 2–10:** `node build-first-10-sets.js` (does not overwrite Set 1)
- Placeholder avatar = **Nadia & Dr. Iwu** everywhere; prose is draft, not locked
- All stems are real bank QIDs (Set 1 reserved; 2–10 mined without reuse)

### What Cursor must do next (when asked to refine a set)
1. **Do not invent questions** — every item is a real QID from `scrape-bank/raw/`.
2. Follow **TRAJECTORY-CURSOR-INSTRUCTIONS.md**: recursive **diagnostic-overlap** graph (not organ-system tags).
3. Every scene of 8 must have one sentence: **"what is being discriminated (X vs Y)"** — if you can't write it, re-cluster.
4. Output **one clear trajectory** (draft scaffold only; live Master Build overwrites set-by-set).
5. **10 avatars** walk the sequence for memorability; story wraps locked QIDs only.
6. Clone Set 1 mechanic only — do not rebuild chips/nav (per first-10-sets instructions).

### Suggested Claude / Cursor tasks (priority)
1. Master review of A vs B rhythm using Sets 1–5 vs 6–10 HTML
2. Tighten weak clusters / rewrite scene-specific Nadia prose (still placeholder)
3. Deduplicate bank by QID → `questions_parsed.json` if needed for larger graph
4. Post-process raw JSON → PNG + `data-linked.json` if needed for study UI
5. Optional: resume scrape on **Omitted** filter only after Unused stays empty  

---

## Graph data schema (`graph-data-set-N.json`)

Per-set metadata files live alongside the story HTML. Two fields were added after the initial bulk generation and may be missing from older sets:

```json
{
  "set": 74,
  "image": "images/tmj-accountant-bruxism-2409.jpg",
  "explanation": "Explanation This patient with referred otalgia…",
  …
}
```

| Field | Source | Notes |
|-------|--------|-------|
| `image` | Auto-wired by `server.js` `/api/append-img` | Relative path under `images/`. Rendered as the set cover in `concept-graphs.html` via `updateCover()`. |
| `explanation` | Extracted from the story HTML's `ITEMS[].explanation` for the canonical node | The answer-key explanation. Auto-wired by `/api/append-img` when the image name ends in a node ID (e.g. `…-2409.jpg`). If the image was placed manually, the explanation must be copied from the story file's `ITEMS` array by matching the node ID. The frontend (`loadSet`) does NOT currently consume this — a future agent should plumb it into the chat context block in `sendChat()`. |

**Set 74** is the first set with both `image` + `explanation` wired; use it as a reference.

---

## Concept-graphs agent pitfalls (DO NOT REGRESS)

Canonical app: `concept-graphs.html` · server: `server.js` on `:8765`.

### 1. Module scope vs IIFE — node clicks die silently

`openHud()`, `closeHud()`, mic wiring, and graph click handlers live at **module scope**. Search UI lives inside `(function initSearch() { … })()`.

| Safe (module-level) | Unsafe (IIFE-only) |
|---------------------|--------------------|
| `let lastHitIds` | Declaring `lastHitIds` only inside `initSearch` |
| `clearSearchHighlights()` / `applySearchHighlights()` | Defining those only inside the IIFE |
| `let activeRecognition` | Leaving SpeechRecognition only in a HUD closure |

**Incident (2026-07-21):** A search-highlight clear was added inside `openHud` that referenced `lastHitIds` / `clearSearchHighlights` from the search IIFE. Every node click threw `ReferenceError: lastHitIds is not defined` → HUD never opened. Looked like “clicks broken”; was a scope crash.

**Rule:** If `openHud`, `closeHud`, `wireHudDictation`, or the D3 `.on('click')` path needs a symbol, declare/define it at **module level** (near `nodeSel`, `activeRecognition`, `lastHitIds`). IIFEs may *call* module helpers; module code must never assume IIFE locals exist.

**Before shipping any `openHud` / click / mic change:**

```powershell
cd C:\Users\steve\MeWorld\step3\scrape-bank
node -e "const fs=require('fs'); const h=fs.readFileSync('concept-graphs.html','utf8'); const m=h.match(/<script>([\s\S]*?)<\/script>/); new Function(m[1]); console.log('JS OK')"
```

Then hard-refresh `:8765/concept-graphs.html`, click a spine node (1–N), a gray mimic, and a teal thread — HUD must open with no console errors.

### 2. Mic dies after switching nodes

Each HUD creates its own `SpeechRecognition`. Closing the HUD without `abort()` leaves Chrome holding the mic; the next node’s mic appears dead until reload.

**Rule:** Keep `activeRecognition` at module scope. `closeHud()` must `abort()` it. `initRec()` / `start()` must abort any stale instance before `rec.start()`.

### 3. Search dim sticks after graph click

`applySearchHighlights` adds `.search-dim` (opacity 0.22). Direct graph clicks must clear via `clearSearchHighlights()` when `event` is truthy. Search-result opens pass `event: null` so one-hit highlight can remain until the user clicks the graph.

Full checklist: **FEATURE_CHECKLIST.md** § Agent pitfalls.

---

## JSON schema (per block file — raw scrape)

Top-level roughly:

```json
{
  "summary": {
    "questionsScraped": 50,
    "revealsCaptured": 50,
    "totalPngCaptured": 5,
    "elapsedFormatted": "5m 30s"
  },
  "pages": [
    {
      "step": 1,
      "questionId": "Question ID:3378",
      "questionNumber": "1/ 50",
      "question": "…stem…",
      "answers": [ /* choices + vote % */ ],
      "explanation": "…",
      "likelyCorrectAnswer": "C.",
      "hasReveal": true,
      "pngDataUrls": [ { "mediaType": "…", "dataUrl": "data:image/png;base64,…" } ],
      "imageCount": 1
    }
  ]
}
```

Images are **embedded base64** in raw JSON until post-processed.

---

## Important: duplicate QIDs are the SAME question

When the same `questionId` appears in multiple blocks:

- **Stem is identical**
- **Answer choices are the same**, but **CCS reshuffles order**
- Letter labels (`A`/`B`/…) and `likelyCorrectAnswer` **change** across appearances
- Deduplicate by **numeric question ID**, not by letter

---

## Post-process (extract PNGs)

Raw JSONs are huge because of base64. To extract:

```powershell
cd C:\Users\steve\MeWorld\step3

# Point batch tool at organized raw folder
node postprocess-batch.js --all --dir "C:\Users\steve\MeWorld\step3\scrape-bank\raw"

# Or single file
node extract-scrape-images.js "C:\Users\steve\MeWorld\step3\scrape-bank\raw\scrape-playwright-block119.json"
```

Output goes under `scrape-export/<name>/data-linked.json` + `images/`.

**Note:** Only early blocks were fully post-processed before; **blocks ~18–119 likely still need `--all`**.

---

## If continuing the scrape

Unused is essentially empty. Next pool to scrape is **Omitted (~5.6k)** (seen but unanswered).

```powershell
cd C:\Users\steve\MeWorld\step3
# After enabling Omitted on Create Test (or teaching handoff to toggle it):
node playwright-scrape-qb.js --loop --auto-next --auto-start --start-block 120
```

Then **move new** `scrape-playwright-block*.json` from `step3\` into `scrape-bank\raw\` and refresh `manifest.json`.

Known handoff pain points (already partially fixed in code):

- Do **not** click Suspend (Pause Block) — use **End Block**
- Close Lab Values / Settings before Confirm (Escape)
- Confirm may need mouse-coordinate click
- When Unused < 50, set question count to Unused before Begin Test
- Only one Chromium on `qb_browser_profile/` at a time

---

## ECG Morph Explorer (2026-08-04)

A standalone interactive ECG waveform morph tool built to match the concept-graphs visual language. Lives alongside the D3 explorer as `ecg-morph.html`.

**File:** `scrape-bank/ecg-morph.html`

**What it does:**
- Mode toggle: **RBBB** (single-lead, P/PR/QRS/T/R' zones) or **LBBB** (dual-lead V1+V6 with annotation arrows)
- Floating slider morphs the trace from normal → bundle branch block with smooth linear interpolation (no jump-cuts)
- Click any segment of the trace or a legend chip to open a draggable HUD explanation panel (matches concept-graphs `.hud` pattern)
- Live QRS duration readout (90 → 160 ms)
- Annotation toggle (LBBB mode) shows/hides arrows pointing to the deep S wave (V1) and broad notched R (V6)
- Full dark theme support via `[data-theme="dark"]`

**Architecture — reusable:**
The `CONFIG` / `CONFIGS` object at the top of the script holds all waveform definitions: point arrays, zone hit-regions, labels, and explanation text. Adding a new before/after morph (e.g. normal → LAD, normal → hyperkalemia) means adding a new config entry — the render engine stays the same.

**Design tokens — matches concept-graphs:**
Same CSS vars (`--ink`, `--muted`, `--accent`, `--coral`, `--border`), Inter font, floating control panels with `backdrop-filter: blur()`, HUD drag bar, identical button/legend/slider patterns. Built to drop into concept-graphs as an embedded component when approved.

**Data sources:**
- RBBB point arrays + zone definitions: hand-crafted from ECG reference
- LBBB V1/V6 arrays: ported from `C:\Users\steve\Downloads\normal_to_lbbb_v1_v6_with_annotations.html`

**Next:**
- Embed into concept-graphs as a first-principles panel (replace placeholder with iframe or inline)
- Add more morph pairs: LAD, hyperkalemia, pericarditis, STEMI
- Wire the "Attending" HUD to a chat interface (the concept-graphs dictation/chat pattern)

---

## Suggested Claude tasks (pick up here)

1. **Post-process all raw JSONs** in `scrape-bank/raw` → slim `data-linked.json` + PNGs  
2. **Build a deduped study bank** keyed by question ID (keep richest reveal + images)  
3. **Index / search** by specialty keywords in stems  
4. Optionally resume scrape on **Omitted** filter  
5. Do **not** commit `ccs_credentials.json`, `qb_browser_profile/`, or huge raw base64 JSONs to git without LFS / ignore

---

## Quick verify

```powershell
cd C:\Users\steve\MeWorld\step3
node -e "const m=require('./scrape-bank/manifest.json'); console.log(m.blockCount,m.uniqueQuestionIds)"
```

---

## Contact context

User ran this overnight via Cursor agent. Scraper is **stopped**. Browser may be closed. Credentials and profile remain on disk for resume.
