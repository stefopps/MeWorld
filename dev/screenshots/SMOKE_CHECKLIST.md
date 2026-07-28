# Case Review HTML — Smoke Checklist

Run this checklist **every time** after rebuilding `case-review-all.html`. Do NOT declare "done" until every box is checked.

## Quick smoke (30 seconds)

```powershell
# 1. Start the HTTP server (if not already running)
python -m http.server 8099 --directory "C:\Users\steve\MeWorld\dev\screenshots"

# 2. Open in browser — navigate to http://localhost:8099/case-review-all.html
```

## Smoke items

### A. JavaScript globals (CDP check)

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | `switchCase` defined | `typeof switchCase` | `function` |
| 2 | `searchCases` defined | `typeof searchCases` | `function` |
| 3 | `handleSearchKey` defined | `typeof handleSearchKey` | `function` |
| 4 | `openLightbox` / `closeLightbox` defined | `typeof openLightbox` | `function` |
| 5 | `askAttending` defined | `typeof askAttending` | `function` |
| 6 | `CASE_CONTEXTS` loaded | `Object.keys(window.CASE_CONTEXTS).length` | Matches case count |

### B. Nav card clickability

| # | Check | How to test | Expected |
|---|-------|-------------|----------|
| 7 | Click nav card switches panel | `switchCase('temporal-arteritis-2026-07-27')` then check `.case-panel.active` id | Panel switches, nav card highlights |
| 8 | Click nav card scrolls to top | After switch, `.main.scrollTop` | `0` |
| 9 | All nav cards have matching `onclick` | Compare nav card `onclick` args to panel IDs | 100% match |

### C. Search

| # | Check | How to test | Expected |
|---|-------|-------------|----------|
| 10 | Search finds cases by keyword | Type "gaba" in search, `searchCases()` | At least 1 result |
| 11 | Search shows result count | Check `#search-count` visibility | Shows "N of M cases" |
| 12 | Search clears on Escape | Press Escape with search focused | Input clears, all cards visible |
| 13 | Keyboard shortcut `/` | Press `/` key | Focuses search input |

### D. Lightbox

| # | Check | How to test | Expected |
|---|-------|-------------|----------|
| 14 | Lightbox opens | `openLightbox('http://...')` | `.lightbox.active` present |
| 15 | Lightbox closes | `closeLightbox()` or Escape | `.lightbox.active` removed |

### E. Ask Attending

| # | Check | How to test | Expected |
|---|-------|-------------|----------|
| 16 | Ask Attending button visible | Look for `#ask-btn-*` | Present in active panel |
| 17 | Opens attending section | Click button | `.attending-section.open` added |
| 18 | API key prompt if no key | Click without key in localStorage | Shows "DeepSeek API key needed" |

### F. Visual / layout

| # | Check | How to test | Expected |
|---|-------|-------------|----------|
| 19 | Images load (no broken imgs) | Scroll panels, look for broken images | No broken/broken-image placeholders |
| 20 | Dark/light theme consistent | Scan several panels | Cards, headers, text uniform |
| 21 | Font renders (Inter, JetBrains Mono) | Check computed styles on body, code blocks | Inter on body, JetBrains on code |

## Common bugs fixed (do not regress)

| Bug | Root cause | Fix location |
|-----|-----------|--------------|
| `switchCase is not defined` | Single quotes in MDC file (`Horner's`, `it's`) break JS string | `_build_review_html.py` → `.replace("'", "\\'")` |
| Panel IDs truncated to 30 chars | `slugify[:30]` | Removed truncation, added collision detection |
| Nav cards don't match panel IDs | Same truncation issue | Fixed with same change |
| Search doesn't find clinical terms | Keywords not in `data-search` | `extract_keywords()` adds bold terms, meds, FA refs |

## Fix checklist

Before running smoke:

1. [ ] `_build_review_html.py` — single quotes escaped in `load_attending_system_prompt()`
2. [ ] `slugify()` no longer truncates (`[:30]` removed)
3. [ ] Collision detection active (two same-name folders won't break)
4. [ ] `case-review-all.html` rebuilt

After smoke passes:

5. [ ] Commit `case-review-all.html` + `_build_review_html.py`
