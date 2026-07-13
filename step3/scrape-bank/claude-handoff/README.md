# Claude Handoff — Concept Graphs + Full Bank

Serve this folder locally, then open the viewer:

```bash
cd claude-handoff
python -m http.server 8765
# Open http://localhost:8765/concept-graphs.html
```

## Files

| File | Size | Purpose |
|------|------|---------|
| `concept-graphs.html` | 25 KB | Live force-directed graph viewer — 20 sets, switch via dropdown |
| `spine-cluster-candidates.md` | — | Full-bank scan report: 7 Type 1 patient-repeat clusters + 16 Type 2 organic-encounter categories |
| `spine-cluster-data.json` | 1.4 MB | Raw signatures: 4,852 questions with age/sex/condition + 245 clusters |
| `text-bank.json` | 16 MB | Full deduped question bank — 4,852 Qs, text only, no images |
| `text-bank.jsonl` | 16 MB | Same as above, one JSON per line (grep-friendly) |

## Viewer features
- 20 sets in a dropdown — click any set to load its force-directed graph
- **Main spine nodes** (coral, numbered) — click for story beat + reveal question
- **Coral spine lines** — click for bridge story connecting two beats
- **Gray nodes** — differential doors (click for comparison cases)
- **Slider** — fade secondary nodes to focus on the spine
- **HUDs are draggable** (by the top bar) and **resizable** (bottom-right corner)
- **Study mode**: "Show Answer" button — correct answer hidden by default
- **Percentages stripped** from answer choices
- **Positions save** to localStorage per set

## Auto-classification caveat
Sets 2-20 use smart classification (likely-answer vs scene-differential terms). Set 1 is hand-crafted. Classification may need master review.

## What we need from you
1. Review the Type 1 clusters in `spine-cluster-candidates.md` — which are genuine patient repeats?
2. Propose organic encounter settings for Type 2 categories
3. Apply the travel-fit check (Nadia → Ghana, Elena → India) for region-specific conditions
4. Recommend avatar assignments for the 3 new-avatar candidates (52M CKD, 32M Graves', 54M AUD)
