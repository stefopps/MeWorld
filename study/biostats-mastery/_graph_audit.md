# Graph-Type Audit — Stats Question Bank (179 questions)

## Headline finding

**135 of 179 questions (75%) are currently rendered on a chart that doesn't match what they're teaching.**

This isn't 135 individual mistakes — it traces to two root causes:

**1. Every concept-tagged question (110 of them) has no `baseGraph.type` at all.**
The app defaults silently to `'cumulative'` (the Kaplan-Meier/hazard-ratio survival chart) whenever `baseGraph.type` is missing. All 110 bulk-generated questions — spanning 50 different concepts including PPV, sensitivity, lead-time bias, meta-analysis, case-control design, ANOVA, and confounding — fall through to that same default. None of these concepts have anything to do with survival curves. This is a single missing-field bug that silently mis-renders a huge fraction of the bank.

**2. A 21-question block (ids 49–69, your Q12/Q13 multi-part cases) was uniformly assigned `'bar'`, regardless of each sub-question's actual topic.**
Within that one block: study-design identification, ROC-curve interpretation, bias identification, ANOVA, trial phases, and meta-analysis all got the same rate-comparison bar chart. One sub-question (Q13g) literally asks "based on the ROC curves..." while the app shows a plain bar chart with no ROC curve anywhere on screen.

The remaining ~44 questions (mostly your original Q1–Q8-ish set, plus the correctly-placed `normal` and a handful of `bar` assignments) already have sensible, deliberately-chosen graph types — those are left alone.

## What already exists vs. what's needed

Only **3 chart types are built**: `cumulative` (survival/HR curves), `normal` (the power/effect-size distribution, just fixed), and `bar` (two-group rate comparison). Everything else in your original handoff's candidate list — PPV curves, ROC curves, forest plots, 2×2 tables, bias diagrams, study-design grids, phase timelines, DAGs — doesn't exist yet.

## Priority list — build order by impact

Ranked by how many currently-mismatched questions each would fix:

| Graph type | Questions unblocked | Status | Why this priority |
|---|---|---|---|
| **Fix the missing-field bug** (assign correct existing types: `normal`, `bar`) | 40 | No new engineering | `normal` fixes 16 questions (power, CI, significance, SD — all already-solved concepts), `bar` fixes 24 (ARR, RRR, incidence, prevalence, attributable risk — all already-solved math). This is pure data-entry, zero code. **Do this first — it's the highest-value, lowest-effort fix on the list.** |
| **`contingencyTable`** (2×2 table, static or interactive) | 17 direct + 4 shared with ROC | New, but simplest new type | Sensitivity, specificity, false pos/neg, odds ratio all read directly off one table. Also the foundation `ppvCurve` needs internally. |
| **`biasDiagram`** | 17 | New | Lead-time, length-time, recall, selection, observer bias. These need a schematic (timeline/population-divergence), not a data chart — but the schematic can be reused across all bias questions with just labels swapped. |
| **`ppvCurve`** | 16 | New, moderate complexity | PPV/NPV-vs-prevalence, exactly the Q87-style example from your original handoff. Needs sensitivity/specificity as fixed inputs and prevalence as the x-axis. |
| **`studyDesignGrid`** | 15 | New, simplest of the "identification" types | Case-control/cohort/RCT identification — likely a static comparison grid with the current scenario highlighted, not much interactivity needed. |
| **`forestPlot`** | 7 | New, moderate complexity | Meta-analysis questions. |
| **`dotplot`** (not in original handoff — see note) | 7 | New, small | Median/mode/range/outlier questions want to see raw data points, not a smooth curve. Small addition, wasn't in your original candidate list but the question content needs it. |
| **`phaseTimeline`** | 6 | New, simple | Trial-phase identification — a static I→II→III→IV strip. |
| **`rocCurve`** | 2 direct + 4 shared with contingencyTable | New | Sensitivity/specificity tradeoff as a cutoff moves. Lower count than expected because most "sensitivity/specificity" questions are actually asking about a single fixed table, not a moving cutoff — only 2 questions explicitly move a cutoff. |
| **`bar` extended to 3+ groups** | 2 | Small extension, not a new type | ANOVA questions just need the existing bar chart to accept more than 2 bars. |
| **`decisionTree`** | 1 | New | "Which statistical test" — low volume, arguably lowest priority. |
| **`dag`** | 1 | New | Confounding — only 1 question currently, lowest priority despite conceptual importance. |

## Implementation notes

**`contingencyTable`** — data already exists in principle (sens/spec are usually stated or derivable from the stem), but the question JSON has no structured field for TP/FP/FN/TN counts. Needs a new `graph: {tp, fp, fn, tn}` or `{sens, spec, prevalence}` shape.

**`ppvCurve`** — needs `{sens, spec}` fixed, prevalence swept 0–100% on the x-axis, with the option's implied prevalence marked as a point. This is a pure function of two numbers — no simulation needed, cheapest of the "new" types computationally.

**`biasDiagram` / `studyDesignGrid` / `phaseTimeline`** — these are the only three that are mostly static/schematic rather than data-driven. They don't need per-question numeric parameters, just per-question labels (e.g., which phase, which bias type, which design) — much less engineering than the curve-based types even though there are a lot of questions in each bucket.

**`forestPlot`** — needs an array of {study name, effect estimate, CI lower, CI upper} per question; none of that structure currently exists in the JSON, would need to be authored per meta-analysis question.

**`dotplot`** — needs a raw array of individual data points per question (for median/mode/range/outlier questions); likely the easiest to hand-author since these questions already reference specific numbers in their stems.

## Full per-question mapping

See the accompanying `graph_recommendations.json` — one entry per question with `currentType`, `recommendedType`, `reason`, `alreadyBuilt` (whether it's one of the 3 existing types or needs new work), and whether it's flagged as a mismatch.

A few notes on how that file was built:
- The 110 concept-tagged questions were mapped concept → recommended type using a table informed by your original handoff's candidate list.
- The 21-question Q12/Q13 block (no concept tag) was classified by keyword-matching the actual question stems, since no metadata was available — worth spot-checking these by hand since keyword matching is less reliable than the concept field.
- Questions already carrying a sensible `normal` or `bar` assignment outside that block were left alone and marked `"mismatch": false`.
