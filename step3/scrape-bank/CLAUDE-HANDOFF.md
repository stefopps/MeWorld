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

## JSON schema (per block file)

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
