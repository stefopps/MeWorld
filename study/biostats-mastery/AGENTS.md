# Agent handoff — Biostats Mastery

Interactive biostatistics study module. 179 questions across 14 graph types, DeepSeek chat assistant, voice dictation, real-time chart controls.

**Repo:** `github.com/stefopps/MeWorld` — path `game/study/biostats-mastery/`

## Quick start

```powershell
cd C:\Users\steve\MeWorld\game\study\biostats-mastery
start index.html   # opens in default browser — no server needed
```

Or just double-click `index.html`. No `npm`, no build, no server. All logic is client-side JS.

## File structure

| Path | Role |
|------|------|
| `index.html` | Everything — HTML, CSS, JS (14 chart renderers, chat, voice, persistence) |
| `stats_questions.json` | 179 questions — the data bank |
| `SCHEMA.md` | Full JSON field reference for every question |
| `reference/` | Reference PDFs + practice problem sets (see `reference/README.md`) |
| `AGENTS.md` | This file |

## What the app does

Three tabs:

| Tab | Purpose |
|-----|---------|
| **ARR / Two Spikes** | Interactive normal-distribution chart — control group vs treatment group as PDFs. Sliders for N, true difference (ARR), show-means toggle, ARR overlay |
| **Hazard Ratio** | Survival-over-time curves (Cox model). Sliders for HR, base rate. Toggle between cumulative-incidence and survival views. Confidence-interval band driven by N slider (SE = 2.23/√n) |
| **Questions** | 179-question bank. Click options to explore graphs. Answer Mode for scoring. Formula/Answer/Chat/Stats/Controls card tabs. Per-question chat with DeepSeek. Voice dictation |

## Data schema

Every question is a JSON object. See `SCHEMA.md` for the full reference. Quick key:

```json
{
  "id": 15,
  "ad": "MetaBoost trial: 12,000 patients...",
  "stem": "Which of the following best explains...",
  "options": [
    {
      "label": "A",
      "text": "The treatment group lost...",
      "graph": { "d": 0.105, "n": 12000 },
      "desc": "Cohen's d = 0.105 means..."
    }
  ],
  "correct": 0,
  "baseGraph": { "type": "normal", "d": 0.105, "n": 12000 },
  "explanation": "The massive sample size...",
  "trap": "Students confuse statistical vs clinical significance..."
}
```

**Critical rule:** `baseGraph.{d,n,hr,brate,control,treatment}` must equal `options[correct].graph.{...}`. This was wrong in 12 questions before the 2026-07-07 audit pass — if you add or edit questions, verify with the lint below.

## Graph types (14 total) and data requirements

| Type | Count | Required fields | What renders |
|------|-------|-----------------|--------------|
| `cumulative` | 29 | `hr`, `brate` | Survival curves (KM step or smooth HR) |
| `bar` | 32 | `control`, `treatment` | Side-by-side bar chart |
| `normal` | 23 | `d`, `n` | Normal distribution (null + true effect PDFs) |
| `contingencyTable` | 21 | `control`, `treatment` | 2×2 table (TP/FP/FN/TN) |
| `biasDiagram` | 16 | _(none)_ | Diagram placeholder |
| `ppvCurve` | 16 | _(none)_ | PPV curve placeholder |
| `studyDesignGrid` | 15 | `control`, `treatment` | Study design comparison grid |
| `forestPlot` | 8 | `rows[]` | Log-scale subgroup forest plot (SVG) |
| `dotplot` | 7 | _(none)_ | Dot plot placeholder |
| `phaseTimeline` | 6 | _(none)_ | Clinical trial timeline |
| `bar-multigroup` | 2 | _(none)_ | Multi-group bar chart |
| `rocCurve` | 2 | _(none)_ | ROC curve placeholder |
| `dag` | 1 | _(none)_ | DAG diagram |
| `decisionTree` | 1 | _(none)_ | Decision tree |

Many types (biasDiagram, ppvCurve, rocCurve, etc.) are placeholders — they show a graph label but don't have interactive chart logic yet. The actively rendered types are: `cumulative`, `bar`, `bar-multigroup`, `normal`, `contingencyTable`, `studyDesignGrid`, `forestPlot`.

## How questions render

`renderQuestion()` → sets up the question UI, attaches click handlers to options.

`pickAnswer(i)` → sets `currentPickedOpt = i`, applies that option's `graph` values to the quiz chart, updates sliders via `updateSlidersFromState()`, calling the right chart renderer based on `qzGraphType`.

Chart renderers (one per type):
- `updateCumulativeChart()` — HR curves, CI band, crossAt support
- `updateNormalChart()` — null + true effect PDFs, Type I/II error shading
- `updateBarChart()` — control vs treatment bars
- `updateForestPlotChart()` — SVG forest plot rows
- `updateContingencyChart()` — 2×2 table cells

State variables drive the live charts:
- `qzHR`, `qzBRate` (cumulative)
- `qzNormD`, `qzNormN`, `qzNormAlpha`, `qzOneTail` (normal)
- `qzBarC`, `qzBarT` (bar)
- `qzCrossAt`, `qzViewMode` (survival view toggle)
- `qzNPerArm` (CI band width)

## Chat assistant

DeepSeek-powered per-question chat. Each question has its own `chatHistory` in localStorage (`schoonmaker_biostats_chat_<questionId>`).

- `askDeepSeek(qIdx, optIdx)` — sends full question context (ad, stem, all options with graph values, explanations, trap) to DeepSeek
- `simplifyThis(qIdx, optIdx)` — fires a "explain this in simple terms" prompt (button is on the formula card)
- `submitChat(qIdx)` — free-text follow-up
- KaTeX rendering: `renderMath()` converts `\(...\)` and `$$...$$` inline

API key: stored in `localStorage` under `schoonmaker_deepseek_key`, set via the gear (Settings) icon.

## Voice dictation

Uses Web Speech API (`SpeechRecognition`). Mic button in the chat dock.
- `startVoice()` — starts recognition
- `stopVoice()` — only calls `.stop()`; the `onend` handler sends the transcript to the chat
- Do not reset `voiceActive` in `stopVoice()` — that was the manual-stop bug

## Known gotchas

1. **baseGraph must match correct answer.** Run this lint after any edits:
   ```javascript
   qs.forEach(q => {
     const c = q.options[q.correct];
     const bg = q.baseGraph;
     ['d','n','hr','brate','control','treatment'].forEach(k => {
       if (bg[k] != null && c.graph[k] != null && Math.abs(bg[k] - c.graph[k]) > 0.001)
         console.log('MISMATCH Q'+q.id+' '+k);
     });
   });
   ```

2. **Q70-179 were migrated from an old schema.** They had `answer: "c"` (letter) instead of `correct: 2` (numeric index). Options had `letter` instead of `label`. No per-option `graph` or `desc` — migrated mechanically, but the graph values are placeholders (marked `"placeholder": true`). These 110 questions need real per-option graph data authored.

3. **`ad` field is only present on 69 questions.** The remaining 110 (Q70-179) don't have preamble text.

4. **`qz-nn-slider` uses cubic mapping.** The HTML range is 0–1000, but maps to n=4–20,000 via `n = 4 + (val/1000)³ × 19996`. Don't change this to linear without recalculating Q15's n=12,000.

5. **`qz-nd-slider` maps 0–250 → d=0–2.5.** Floor is 0 (not 0.1). Some questions (8, 11, 12, 15, 18, 19) author the true-null case at d=0.

6. **Forest plots are SVG, not Chart.js.** `chart-quiz-forest` is a `<div>`, not a `<canvas>`. Rendered by `updateForestPlotChart()` which creates SVG elements directly.

7. **Symbol reference: `qzDimPlugin`** draws HR velocity annotations (control/treatment dots with labels) and is only active when `qzGraphType === 'cumulative'` — this guard was added to prevent it from bleeding onto non-HR charts.

## Reference books

Located in `reference/reference-books/`. See `reference/README.md` for the full catalog.

| Book | Path | Use for |
|------|------|--------|
| Understandable Statistics (Brase & Brase) | `reference/reference-books/Understandable_statistics_KOS.pdf` | Core concepts, formulas, distributions, hypothesis testing fundamentals |
| High-Yield Biostatistics (Glaser) | `reference/reference-books/High-yield-Glaser-...pdf` | USMLE-style review, epidemiology, public health, test characteristics |

When authoring question explanations or verifying graph math, pull concepts from these books — don't invent terminology or formulas.

## Test checklist

- [ ] Open `index.html` in browser
- [ ] ARR tab: normal chart renders, sliders work, "Show Means" toggle works
- [ ] HR tab: survival curves render, HR/base-rate sliders work, "Survival view" toggle works, CI band visible and narrows with N slider
- [ ] Questions tab: click any option → chart renders correctly for its type, formula card populates
- [ ] Questions tab: Answer Mode → pick an option → scoring works (green/red flash, answer card shows results)
- [ ] Chat: click "Explain this option" or "Simplify this" → reply appears with KaTeX rendering
- [ ] Voice: click mic → speak → click stop → transcript appears in chat
- [ ] Console: no errors on load or option click

## Related handoffs

- `C:\Users\steve\Downloads\_cursor_handoff.md` — batch-by-batch audit notes from the 2026-07-07 QA pass
- `SCHEMA.md` — full JSON field reference
- `reference/README.md` — book catalog and sync instructions
