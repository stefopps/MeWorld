# Cursor Instructions — Draft Sets 1-10 (Avatar Saga v2)

## Status of this output
DRAFT for Master's review, not final content. Sets get overwritten as the live-fed Build step
reaches them for real study. This batch exists so Master can compare structure choices on real
content before locking the pattern for all ~100 sets.

## What "Set 1" already is
Set 1 (lupus/CTD chain, 40 questions, 5 scenes) is done — it's spine-story-demo-v2.html.
Use it as the literal template. Clone its CSS, its JS (SCENES grouping, chipify, cardHTML,
render, nav), and its file structure exactly. Only these things change per set:
- The ITEMS array (real scraped questions for that set's topic chain)
- The STORY_STEPS content (new prose, same 8-stage Harmon Circle shape)
- Header text (set number, topic chain name, scene titles/hooks/beats)
Do not touch the mechanic (chips, scene nav, card reveal). If it isn't broken, don't rebuild it.

## Avatar consistency (placeholder, not locked)
Master has not locked the avatar's real identity yet. Until he does:
- Use the SAME placeholder name and voice across all 10 sets (reuse "Nadia" and Dr. Iwu from
  Set 1, or pick one placeholder identity and use it everywhere — do not vary it set to set).
- Tag every set's story panel with the same placeholder badge already in Set 1
  (`Placeholder avatar & prose — not locked content`).
- This makes the eventual real-avatar swap a single find-and-replace across 10 files, not a
  rewrite. Do not get creative with the avatar's identity per set — sameness here is the point.

## Step 1 — Build 10 topic chains from the scraped bank
Using the same diagnostic-overlap clustering already proven on Set 1 (score pairs by shared
presentation/mechanism/trigger, not organ system tag), produce 9 new 40-question chains from
the scraped bank, on top of the existing Set 1 lupus/CTD chain. Pick chains that are naturally
differential-rich — conditions test-takers actually confuse — not just "10 more organ systems."
Log a one-sentence differential rationale per scene, same as Set 1's sceneHook field.
If a chain doesn't have 40 questions with real overlap in the bank, don't pad it with weak
matches. Flag it short and move to the next chain.

## Step 2 — Split the 10 sets into two structural patterns (A/B test for Master)
This directly tests the repetition risk Master flagged after seeing Set 1: does a full 8-step
Harmon Circle in every scene read as rhythm or as repetition once you've seen it 5 times in one
set, 100 times across the saga?

**Sets 1-5 — Pattern A (current Set 1 style).**
Every scene runs the full 8-step circle (You/Need/Go/Search/Find/Take/Return/Change), one real
question mapped to each stage by narrative function, stage tags visible.

**Sets 6-10 — Pattern B (flattened middle).**
Only Scene 1 (entry) and Scene 5 (resolution) run the full 8-step circle. Scenes 2, 3, and 4
drop the stage tags and Harmon structure entirely — go back to a flatter frame (2-3 short
paragraphs of avatar narrative, then the 8 chips woven in as comparison cases without a forced
8-stage shape, similar to the v1 mechanic before the Circle was added). Keep the chip-to-card
mechanic identical either way.

Do not mix patterns within a single set. Keep the split clean at 5/5 so the comparison is fair.

## Step 3 — Output
One HTML file per set, named `set-0N-story-vX.html` (X = a or b matching its pattern).
Each file is a full standalone clone of the Set 1 scaffold with only ITEMS/STORY_STEPS/header
changed. Also output a short `sets-manifest.md`:
- Set number, topic chain, pattern used (A/B), one-line differential rationale per scene,
  any flagged low-confidence clusters, question count if short of 40.

## Guardrails
- No fabricated question content. Every question in ITEMS must be a real scraped stem, unedited.
- No invented differential relationships to force a clean cluster of 8. Flag weak clusters.
- Keep avatar identity and voice identical across all 10 files, placeholder tag visible on every
  scene panel of every set.
- Do not let Pattern A vs Pattern B affect anything except the story-prose structure. The
  underlying question data, clustering logic, and chip mechanic stay identical across both.
