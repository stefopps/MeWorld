# Reference materials

Study PDFs synced with the repo (for use on any machine after `git pull`).

## For agents — which book for what

When authoring question explanations, verifying formulas, or writing teaching text, pull from these books. Do not invent terminology or math.

| Book | Path | Best for |
|------|------|----------|
| **Understandable Statistics** (Brase & Brase) | `reference-books/Understandable_statistics_KOS.pdf` | Core concepts, distributions, hypothesis testing, confidence intervals, effect sizes, power analysis, regression basics |
| **High-Yield Biostatistics** (Glaser) | `reference-books/High-yield-Glaser-Anthony-N-Biostatistics-epidemiology-and-public-health-Wolters-Kluwer-2014.pdf` | USMLE-style review, study designs, bias types, screening test characteristics (Sn/Sp/PPV/NPV), epidemiology measures, clinical trial phases, attributable risk, NNT |

**Workflow when a question needs book-backed content:**

1. Read the question's `concept` and `tags` fields (if present)
2. Search the relevant PDF with the concept term
3. Paraphrase in Immersa attending voice — never paste verbatim
4. Cite the book page in `book_ref` field

## In git (this folder)

| File / folder | Notes |
|---------------|-------|
| `reference-books/Understandable_statistics_KOS.pdf` | **Understandable Statistics** by Brase & Brase (~52 MB) |
| `reference-books/High-yield-Glaser-Anthony-N-Biostatistics-epidemiology-and-public-health-Wolters-Kluwer-2014.pdf` | **High-Yield Biostatistics, Epidemiology & Public Health** by Glaser (~7 MB) |
| `Practice Questions/` | Scribd MCQ PDFs, notes — practice problem sets only |
| `README.md` | This file |

## Adjacent agent docs (in parent folder)

| Doc | Purpose |
|-----|---------|
| `AGENTS.md` | Full module handoff — how to run, architecture, gotchas, test checklist |
| `SCHEMA.md` | JSON field reference for all 14 graph types |

## Local only (not in git)

| Item | Where |
|------|--------|
| UWorld 3-block OCR PDF (~116 MB) | Too large for GitHub — keep in `Downloads` or copy manually |
| Study videos | `Documents\Resit Step 3\03 - Biostatistics and Public Health\Videos\` |

## Re-sync from Documents (this PC)

```powershell
cd study\biostats-mastery

robocopy "C:\Users\steve\Documents\Resit Step 3\03 - Biostatistics and Public Health" "reference" /E /COPY:DAT /XD Videos /XF "UW 2024 - Biostatistics & Epidemiology - 3 blocks - OCR.pdf"

robocopy "C:\Users\steve\Documents\Resit Step 3\05 - Reference Books" "reference\reference-books" /E /COPY:DAT
```

Then `git add reference/` and commit.
