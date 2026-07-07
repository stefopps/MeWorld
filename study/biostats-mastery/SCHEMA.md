# Biostats question schema

Every question in `stats_questions.json` follows this structure. Field presence varies by graph type and whether the question was migrated from the old schema (Q70–179).

## Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | integer | Yes | Unique question ID (1–179) |
| `ad` | string | No | Trial/preamble text — only present on Q1–69 |
| `stem` | string | Yes | The question itself |
| `options` | array | Yes | 5 answer options (sometimes fewer on migrated questions) |
| `correct` | integer | Yes | Index of the correct answer in `options` (0-based) |
| `baseGraph` | object | Yes | Default graph values — what renders before the student clicks anything |
| `trapGraph` | object | No | Alternate graph for the "show trap" button (only 3 questions have this) |
| `explanation` | string | Yes | Full explanation shown in Answer Mode |
| `trap` | string | Yes | Teaching trap / common mistake |
| `tags` | array | No | Topic tags (only on Q70–179) |
| `book_ref` | string | No | Textbook reference (only on Q70–179) |
| `source` | string | No | Question source (only on Q70–179) |
| `concept` | string | No | Concept bucket (only on Q70–179) |
| `difficulty` | string | No | Difficulty rating (only on Q70–179) |

## Option object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | Yes | Display label ("A" through "E") |
| `text` | string | Yes | The answer text |
| `graph` | object | Yes | Per-option graph values (see type-specific fields below) |
| `desc` | string | Yes | Explanation for this specific option |

## baseGraph object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Graph type identifier (see Graph types below) |
| `rawLabel` | string | No | Real-world units label appended to chart legend (only Q15, Q18, Q19) |
| _(type-specific)_ | varies | Per type | See Graph types below |

**Rule:** `baseGraph` values (d, n, hr, brate, control, treatment, etc.) must equal `options[correct].graph.{same key}` for the matching keys. This was wrong in 12 questions before the 2026-07-07 audit.

## Graph types — required baseGraph fields

### `cumulative` — Hazard Ratio survival curves

```
baseGraph: { type: "cumulative", hr: number, brate: number }
option.graph: { hr: number, brate: number }
```

Optional: `crossAt` (number — time point where treatment/control cross), `hrEarly` (HR before cross), `n` (cohort size, affects CI band)

### `bar` — Side-by-side bar chart

```
baseGraph: { type: "bar", control: number, treatment: number }
option.graph: { control: number, treatment: number }
```

Values are raw proportions (0.0–1.0). Chart plots them directly (no ×100 conversion). If the ad says 3%, store `0.03`.

### `normal` — Normal distribution (null + true effect)

```
baseGraph: { type: "normal", d: number, n: number, alpha?: number }
option.graph: { d: number, n: number }
```

- `d` = Cohen's d (standardized mean difference)
- `n` = sample size per arm
- `alpha` defaults to 0.05
- Optional: `rawLabel` on baseGraph — real-world units, e.g. `"MetaBoost 5.3kg vs Placebo 5.0kg (0.3kg diff)"`

### `contingencyTable` — 2×2 table

```
baseGraph: { type: "contingencyTable", control: number, treatment: number }
option.graph: { control: number, treatment: number }
```

### `forestPlot` — Subgroup forest plot (SVG)

```
baseGraph: {
  type: "forestPlot",
  title: string,
  rows: [
    { label: string, estimate: number, ciLow: number, ciHigh: number, pValue: number }
  ],
  nullLine: number  // typically 1.0 for HR/RR/OR
}
```

Rendered as SVG (not Chart.js canvas). `chart-quiz-forest` is a `<div>`.

### `studyDesignGrid` — Study design comparison

```
baseGraph: { type: "studyDesignGrid", control: number, treatment: number }
option.graph: { control: number, treatment: number }
```

### Placeholder types (no interactive chart yet)

These types show a label but don't have chart rendering logic:
- `biasDiagram` — 16 questions
- `ppvCurve` — 16 questions
- `dotplot` — 7 questions
- `phaseTimeline` — 6 questions
- `rocCurve` — 2 questions
- `dag` — 1 question
- `decisionTree` — 1 question

For these, `option.graph` can be `{}` or `{ placeholder: true }` — the chart won't use it.

### `bar-multigroup` — Multi-group bar chart

```
option.graph: { control?: number, treatment?: number }
```

## Special graph features

### crossAt (cumulative type only)

```json
"graph": { "hr": 0.80, "brate": 0.20, "crossAt": 12, "hrEarly": 0.60 }
```

When present, `syncViewModeToCrossAt()` auto-switches to survival view. Without crossAt, the cumulative view draws a single flat exponential that ignores crossing hazards.

### trapGraph

```json
"trapGraph": { "hr": 0.60, "brate": 0.30 }
```

Only 3 questions (1, 3, 4) have this. Adds a "Show trap" button that renders an alternate graph.

## Old schema (Q70–179) — what changed

Before 2026-07-07, questions 70–179 used a different schema:

| Old field | New field | Notes |
|-----------|-----------|-------|
| `answer: "c"` | `correct: 2` | Letter → numeric index |
| `option.letter: "a"` | `option.label: "A"` | Lowercase → uppercase |
| _(missing)_ | `option.graph` | Added as placeholder (`{ placeholder: true }`) |
| _(missing)_ | `option.desc` | Copied from question-level `explanation` |

These 110 questions still have placeholder graph values — they work mechanically but don't have distinct per-option visualizations. Real graph data needs to be authored per question.
