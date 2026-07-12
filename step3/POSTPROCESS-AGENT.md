# Agent handoff: Post-process CCS QB scrape JSONs (batches of 10)

## Goal

Post-process all downloaded scrape JSON files from the CCS Question Bank Playwright scraper. Work in **batches of 10 files** per run. Do **not** touch the live scraper or browser.

## Repo path

`C:\Users\steve\MeWorld\step3\`

## Input files (priority order)

1. **Playwright outputs (canonical):** `C:\Users\steve\MeWorld\step3\scrape-playwright*.json`
2. **Legacy Downloads (optional batch 2+):** `C:\Users\steve\Downloads\scrape-output*.json`

As of handoff, Playwright files include:

| File | Notes |
|------|--------|
| `scrape-playwright-output.json` | Block 1 |
| `scrape-playwright-block2.json` | |
| `scrape-playwright-block3.json` | 38/50 reveals |
| `scrape-playwright-block4.json` | 50/50 reveals |
| `scrape-playwright-block5.json` | 50/50, 7 images |
| `scrape-playwright-block6.json` | 50/50 |
| `scrape-playwright-block7.json` | may still be scraping — skip if file is locked/incomplete |

## What post-processing does (per JSON file)

1. **Extract embedded PNGs** from `pngDataUrls` / `data:image/...` fields
2. **Write linked JSON** with relative `file` paths instead of huge base64 blobs
3. **Output layout:**

```
C:\Users\steve\MeWorld\step3\scrape-export\
  scrape-playwright-block4\
    data-linked.json      ← slim JSON, images as file refs
    images\q01\...png
    README.md
  batch-01-manifest.json  ← batch summary
```

## Commands

```powershell
cd C:\Users\steve\MeWorld\step3

# Batch 1 — first 10 JSON files (newest first across step3 + Downloads)
node postprocess-batch.js --batch 1 --batch-size 10

# Batch 2 — next 10 files
node postprocess-batch.js --batch 2 --batch-size 10

# All remaining batches
node postprocess-batch.js --all --batch-size 10

# Playwright files only (step3 dir only)
node postprocess-batch.js --dir "C:\Users\steve\MeWorld\step3" --all --batch-size 10
```

Single-file fallback:

```powershell
node extract-scrape-images.js "C:\Users\steve\MeWorld\step3\scrape-playwright-block4.json"
```

## Success criteria (per file)

- `data-linked.json` exists under `scrape-export/<basename>/`
- Manifest shows `status: "ok"`
- Log reports `questionsScraped` and `imagesExtracted`
- No credentials committed (never touch `ccs_credentials.json`)

## Batch workflow for agent

1. `cd C:\Users\steve\MeWorld\step3`
2. Run `node postprocess-batch.js --batch 1 --batch-size 10`
3. Read `scrape-export/batch-01-manifest.json` — report totals
4. If more files remain, run `--batch 2`, etc., or `--all`
5. Optional: run categorization later (`categorize-scrape-questions.js` needs per-block topic maps — not automated yet)

## Do NOT

- Run Playwright scraper concurrently (locks `qb_browser_profile/`)
- Commit `ccs_credentials.json`, `qb_browser_profile/`, or raw scrape JSON to git
- Modify scrape JSON sources — outputs go only under `scrape-export/`

## If a file fails

- Skip and note in manifest (`status: "error"`)
- Common cause: invalid/truncated JSON from interrupted scrape — wait for scrape to finish and re-run batch

## Report back to user

After each batch, summarize:

- Files processed / failed
- Total questions + reveals + PNGs extracted
- Paths to `batch-NN-manifest.json` and export folders
