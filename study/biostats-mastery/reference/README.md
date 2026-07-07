# Reference materials

Study PDFs synced with the repo (for use on any machine after `git pull`).

## In git (this folder)

| File / folder | Notes |
|---------------|-------|
| `reference-books/Understandable_statistics_KOS.pdf` | **Understandable Statistics** (~52 MB) |
| `Practice Questions/` | Glaser high-yield, Scribd MCQ PDFs, notes |
| `README.md` | This file |

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
