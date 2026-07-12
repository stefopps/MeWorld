# Cursor Instructions — Recursive Trajectory Builder (Step 3 Avatar Saga)

> Source: Downloads copy · live path for agents working the bank.

## Status of this output
This produces a **DRAFT trajectory only**. Per the framework rule, real set-building stays live-fed
as Master studies. This script exists to give one ordered scaffold so the saga has a spine before
live sets start overwriting it set by set. **Do not treat scraped-file clustering as final content.**

## Objective
Take the scraped question bank (`scrape-bank/raw/`) and output **ONE ordered trajectory**: a sequence of
~100+ sets (for ~4,868 unique IDs ÷ 40), each set broken into **5 scenes of 8 questions**, clustered by
**diagnostic overlap** ("what could this be confused with"), **not** by organ system tag.

## Input
- `scrape-bank/raw/scrape-playwright*.json` — question ID, stem, answers, explanation
- Deduplicate by numeric `questionId` first (`unique-question-ids.txt` / `manifest.json`)
- If a subset has ID + system tag only and no stem text, **flag immediately** — overlap
  clustering needs more than a system label. Do **not** silently proceed with system-only grouping
  (that is the "8 hypertension questions" failure mode).

## Step 1 — Parse and tag
For each unique question, extract:
- id
- system/domain hints (from text, not assumed)
- keywords, associated conditions, answer choices that hint at differentials
Output: `scrape-bank/questions_parsed.json`

## Step 2 — Build the overlap graph (recursive core)
This is **not** a single pass. Run it recursively:
1. First pass: group by shared possible diagnosis / mechanism / trigger, **not** system.
   Two questions overlap if a test-taker could plausibly confuse one for the other
   (shared presentation, trigger, mechanism, common look-alike pairing).
2. Score every pair (0–1) on overlap strength (keyword overlap, shared differential terms,
   shared triggers like "sun exposure," "smoke," "pregnancy").
3. Recursive refinement: after clustering, re-check each cluster of 8 — does it read as a single
   **differential thread**, or did system-tag gravity sneak back in? If a cluster is just
   "8 things tagged cardiology," **break it** and re-cluster on the next-strongest overlap edges.
   Repeat until every cluster of 8 has a coherent **"is it X or is it Y"** throughline.
4. Log the rationale per cluster — **one sentence per scene** explaining the differential being tested.
   **If you can't articulate that sentence, the cluster isn't done.**

## Step 3 — Assemble scenes into sets
- 5 scenes (clusters of 8) = 1 set = 40 questions
- Within a set, scenes follow rising stakes: entry → complication → deepening → turning point → resolution
- Prefer sets where a thread carries across 2–3 scenes with a twist
  (skin → skin + sun → lungs, same underlying disease family)

## Step 4 — Sequence the sets into one trajectory
- Rough difficulty ramp
- Callback logic: seed 2–3 objects/locations/stakes early; tag later sets that resurface them
- Even distribution of high-yield domains across the full trajectory
- Output the full ordered manifest

## Output format
```json
{
  "set_number": 1,
  "scenes": [
    {
      "scene_number": 1,
      "differential_theme": "one sentence: what is being discriminated here",
      "question_ids": ["id1","id2","...8 total"]
    }
  ]
}
```
Also CSV: `Set #, Topics/Domains Covered, Scenes Built, Studied, Retention Test Passed`
— leave Studied / Retention blank (filled live).

## Guardrails
- Do not fabricate differential relationships if signal is weak — **flag low-confidence** clusters.
- Draft ≠ canon. Live Build overwrites each set when Master reaches it.
- Remainder that won't fill a coherent 40 → **unassigned pool**, never weak-overlap filler.
- **10 avatars** each walk this trajectory (or partitioned segments) for memorability —
  story/avatar glue wraps **real QIDs only**.

## Relation to spine-demo.html
`build-spine-demo.js` is a **one-spine prototype** (keyword adjacency → HTML next/next).
This document is the **full recursive standard**. Upgrade the demo until every scene has an
explicit `differential_theme` sentence and fails system-only clusters.
