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

## index.html — code map

All logic lives in `index.html` (~2700 lines). Here's where to find everything by line number.

### HTML structure

| Lines | Section |
|-------|---------|
| 1–189 | `<head>` — CSS, Chart.js CDN, Tabler icons, KaTeX, Google Fonts |
| 190–389 | Tab bar + chart panels (all `<canvas>` + `<div>` elements) |
| 390–443 | Quiz card (formula, chat, answer, stats, controls tabs) |
| 444–447 | Bottom-right card (draggable/resizable) |

### State variables (lines 479–518)

| Line | Variable | What it holds |
|------|----------|---------------|
| 479 | `QUESTION_BANK` | All 179 questions (loaded from JSON) |
| 498 | `SK` | localStorage key: `"stats_viz_questions"` |
| 499 | `qState` | `{ answers: {}, score: 0 }` — persisted |
| 500 | `currentQ` | Current question index (0-based) |
| 500 | `qAnswered` | Has the student answered yet? |
| 500 | `qMode` | `"viz"` (explore) or `"answer"` (scoring) |
| 501 | `qzHR`, `qzBRate` | Cumulative chart: hazard ratio, base rate |
| 501 | `qzCrossAt` | Crossing-hazard time point (null when none) |
| 502 | `qzViewMode` | `"cumulative"` or `"survival"` |
| 503 | `qzNPerArm` | N per arm for CI band (cumulative chart) |
| 504 | `qzGraphType` | Active question's chart type |
| 506 | `qzNormD`, `qzNormN`, `qzNormAlpha` | Normal chart: Cohen's d, N, alpha |
| 506 | `qzOneTail` | One-tailed vs two-tailed toggle |
| 508 | `qzBarC`, `qzBarT` | Bar chart: control%, treatment% |
| 513–518 | `pivotMode`, `pivotBank`... | Adaptive practice mode (concept-sorted) |

### Core flow (lines 482–1036)

| Line | Function | What it does |
|------|----------|--------------|
| 482 | `loadQuestions()` | Fetches `stats_questions.json`, populates `QUESTION_BANK` |
| 706 | `loadQS()` / `saveQS()` | Persist `qState` (answers + score) to localStorage |
| 717 | `setQMode(mode)` | Switch between `"viz"` and `"answer"` modes |
| 730 | `switchCardTab(tab)` | Switch the active bottom card tab (formula/chat/answer/stats/controls) |
| 741 | `renderFormulaForOption()` | Render math formula + explanation text for the picked option |
| 789 | `renderQuestion()` | Full question render — stem, option buttons, graph, card tabs |
| 885 | `syncViewModeToCrossAt()` | Auto-switch survival/cumulative view when crossAt data exists |
| 891 | `updateSlidersFromState()` | Sync HTML sliders to current graph state values |
| 913 | `pickAnswer(i)` | Option click handler — applies graph preset, updates chart, highlights UI |
| 947 | `applyGraphPreset()` | Set cumulative chart state from option values |
| 948 | `applyNormalPreset()` | Set normal chart state from option values |
| 949 | `applyBarPreset()` | Set bar chart state from option values |
| 951 | `applyGraphPresetByType()` | Dispatch to the right preset based on `baseGraph.type` |
| 971 | `nextQuestion()` / `prevQuestion()` | Navigate questions, persist position |
| 980 | `finishQuestionJump()` | Jump to a specific question from the list |
| 990 | `toggleTrapCurve()` | Show/hide the trap curve on cumulative charts |
| 998 | `toggleCompareCurves()` | Show baseline control/treatment for comparison |
| 1009 | `hideAllQuizChartPanels()` | Hide all chart canvases/divs before showing the active one |
| 1036 | `updateQuizVisualForOption()` | Show ad image (if present) for the selected option |
| 1057 | `updateQuizGraph()` | Main dispatch — routes to the right chart renderer by `qzGraphType` |

### Chart renderers (lines 1120–1892)

| Line | Function | Graph type |
|------|----------|------------|
| 1120 | `updateCumulativeChart(q, bg)` | `cumulative` — KM steps or smooth HR curves, CI band, crossAt |
| 1196 | `updateNormalChart(q, bg)` | `normal` — null + true effect PDFs, Type I/II error shading |
| 1232 | `updateBarChart(q, bg)` | `bar` / `bar-multigroup` — side-by-side bars |
| 1344 | `updatePPVCurveChart(q, bg)` | `ppvCurve` — PPV vs prevalence curve |
| 1414 | `updateForestPlotChart(q, bg)` | `forestPlot` — SVG forest plot (NOT Chart.js) |
| 1591 | `updateROCChart(q, bg)` | `rocCurve` — ROC curve |
| 1633 | `updateDotplotChart(q, bg)` | `dotplot` — individual data points |
| 1678 | `renderContingencyTable(q, bg)` | `contingencyTable` — 2×2 table |
| 1725 | `renderBiasDiagram(q, bg)` | `biasDiagram` — bias type diagram (placeholder) |
| 1785 | `renderStudyDesignGrid(q, bg)` | `studyDesignGrid` — study design comparison |
| 1828 | `renderPhaseTimeline(q, bg)` | `phaseTimeline` — trial phases |
| 1875 | `renderDAG(q, bg)` | `dag` — causal DAG |
| 1892 | `renderDecisionTree(q, bg)` | `decisionTree` — decision tree diagram |

### Math utilities (lines 1191–1194)

| Line | Function | Purpose |
|------|----------|---------|
| 1191 | `pDF(x, m, s)` | Normal probability density function |
| 1192 | `cDF(x, m, s)` | Normal cumulative distribution via `eRF` |
| 1193 | `eRF(x)` | Error function approximation |
| 1194 | `nQ(p)` | Inverse normal CDF (quantile function) |

### Chart.js instances (lines 1290–2190)

| Line | Variable | What |
|------|----------|------|
| 1290 | `chartQuiz` | Cumulative quiz chart (main — HR curves, CI bands, trap, compare) |
| 1293 | `chartQuizNormal` | Normal distribution quiz chart |
| 1317 | `chartQuizBar` | Bar chart quiz chart |
| 1338 | `chartQuizPPV` | PPV curve chart (created dynamically) |
| 1412 | `chartQuizForest` | Deprecated — forest plots now use SVG |
| 1590 | `chartQuizROC` | ROC curve chart |
| 1632 | `chartQuizDot` | Dotplot chart |
| 2182 | `chartARR` | ARR / Two Spikes tab chart |
| 2190 | `chartHR` | Hazard Ratio tab chart |

### Chart plugins (lines 1256–1277)

| Line | Plugin ID | Purpose |
|------|-----------|---------|
| 1256 | `qzDim` | HR velocity annotations (control/treatment dots) — only when `qzGraphType === 'cumulative'` |
| 1260 | `qzNormalLabels` | "Retain H₀" / "Reject H₀" labels on normal chart |

### ARR + HR tabs (lines 2179–2204)

| Line | Function | Purpose |
|------|----------|---------|
| 2183 | `updateARR()` | Redraw ARR chart from N/diff sliders + cubic N scaling |
| 2184 | `updateARRCard()` | Update ARR card values (SE, ARR, NNT, Z-score) |

### Chat + voice (lines 2462–2708)

| Line | Function | Purpose |
|------|----------|---------|
| 2462 | `renderChatPanel(qIdx)` | Render per-question chat history |
| 2479 | `submitChat(qIdx)` | Free-text chat follow-up |
| 2494 | `simplifyThis(qIdx, optIdx)` | Fire "explain this in simple terms" prompt |
| 2516 | `askDeepSeek(qIdx, optIdx, followUpText?)` | Send full question context to DeepSeek API |
| 2654 | `startVoice()` | Web Speech API — start dictation |
| 2708 | `stopVoice()` | Web Speech API — stop dictation (only calls `.stop()`, lets `onend` send) |
| ~2358 | `renderMath(text)` | Convert `\(...\)` and `$$...$$` to KaTeX |

### Pivot mode (lines 520–680)

Adaptive practice: sorts questions by concept level, tracks mastery.

| Line | Function | Purpose |
|------|----------|---------|
| 520 | `loadPivotManifest()` | Load concept hierarchy from `pivot_manifest.json` |
| 545 | `enterPivotMode()` | Activate pivot mode, reorder question bank |
| 618 | `exitPivotMode()` | Restore original question order |
| 646 | `updatePivotUI()` | Update pivot progress bar + layer indicator |

### Tab switching (lines 1936–1951)

| Line | Function | Purpose |
|------|----------|---------|
| 1936 | `switchTab(t)` | Switch between ARR, HR, Questions tabs (uses `data-tab` attribute) |

### Draggable/resizable card (lines 1968–2177)

| Line | Function | Purpose |
|------|----------|---------|
| 1968 | `CARD_STORAGE_KEY` | Persists card positions to localStorage |
| 2015 | `applySharedSize()` | Apply saved card dimensions |
| 2025 | `autoFitCard()` | Auto-size the card to fit content |
| 2115 | `computeResize()` | Handle resize grips (right, bottom, corner)

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
