# Avatar Saga — Full Bank Sets Manifest

**Total sets:** 130 (Sets 1–20 hand-crafted, Sets 21–130 auto-generated)

**Total questions:** 4,852

**Viewer:** Open concept-graphs.html via http://localhost:8765/concept-graphs.html

**Full manifest:** See GRAPH-MANIFEST.md for per-set breakdown (primary/mimic/thread counts, story files, graph data).

## Sets 1–20 (Hand-crafted)

| Set | Avatar | Pattern | Core territory | File |
|-----|--------|---------|----------------|------|
| 1 | Nadia | A | Lupus/CTD | set-01-story-va.html |
| 2 | Amara + Dr. Reyes | A | Chest pain | set-02-story-va.html |
| 3 | — | A | Syncope | set-03-story-va.html |
| 4 | — | A | Anemia | set-04-story-va.html |
| 5 | — | A | Thyroid | set-05-story-va.html |
| 6 | — | B | Dyspnea | set-06-story-vb.html |
| 7 | — | B | Acute abdomen | set-07-story-vb.html |
| 8 | — | B | Jaundice | set-08-story-vb.html |
| 9 | — | B | Headache | set-09-story-vb.html |
| 10 | — | B | Joint pain | set-10-story-vb.html |
| 11 | Marcus Chen | A | Diabetes | set-11-story-va.html |
| 12 | — | A | Acid-Base | set-12-story-va.html |
| 13 | — | A | Electrolytes | set-13-story-va.html |
| 14 | — | A | Stroke | set-14-story-va.html |
| 15 | — | A | Renal | set-15-story-va.html |
| 16 | Elena Vasquez | B | GI Bleed | set-16-story-vb.html |
| 17 | Robert Kim | B | Arrhythmias | set-17-story-vb.html |
| 18 | — | B | Sepsis/Shock | set-18-story-vb.html |
| 19 | — | B | Endocrine | set-19-story-vb.html |
| 20 | — | B | Infectious disease | set-20-story-vb.html |

## Sets 21–130 (Auto-generated)

Grouped by diagnostic domain: cardio (1,452 Qs), renal (843), neuro (389), resp (378), heme (356), GI (308), psych (53), and more. See GRAPH-MANIFEST.md for full per-set table.

## Usage

```bash
cd scrape-bank
python -m http.server 8765
# Open http://localhost:8765/concept-graphs.html
```

Regenerate with: `node build-full-bank-graphs.js`
