# Concept Graphs — Feature Implementation Checklist

> Last updated: 2026-07-21 · File: `concept-graphs.html`
> Server: `server.js` · Log: `deepseek-log.jsonl`
> Coverage: 130 sets (130 graph-data JSONs + 130 story HTMLs, all 4,852 questions)
>
> **Agent pitfalls (scope / mic / search):** see bottom of this file + `CLAUDE-HANDOFF.md` § Concept-graphs agent pitfalls + `CURSOR-INSTRUCTIONS-CONCEPT-GRAPH.md` § Runtime pitfalls.

---

## Core Graph & Data

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | 130 concept graph sets (1–130, full bank coverage) | ✅ | 130 `graph-data-set-NN.json` + 130 `set-NN-story-v*.html` |
| 2 | Unified viewer with set dropdown (1–130) | ✅ | Clean bigram-phrase labels via `cleanDiagnosisLabel()` |
| 3 | Force-directed D3 graph with smooth zoom/pan | ✅ | D3 v7.9, scroll zoom, middle-mouse pan |
| 4 | Fit-to-view button | ✅ | Percentile-clamped to ignore distant outliers |
| 5 | Node color categories: coral (spine), gray (mimic doors), teal (thread) | ✅ | `COLORS` map |
| 6 | Scene background halos (per-scene convex-hull rings) | ✅ | Subtle visual grouping |
| 7 | Lines toggle (show/hide all edges) | ✅ | `—` / `╱` icon states |

---

## Node Interaction

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 8 | Click node → open floating HUD with reveal | ✅ | `openHud()` — **must not reference IIFE-only symbols** (see Agent pitfalls) |
| 9 | **Live-node indicator** — green ring on the graph node whose panel is currently open | ✅ | Updates on click, arrow-cycle, keyboard, and timeline jump |
| 10 | Ctrl+click → isolate node (show only 1-hop subset neighbors) | ✅ | Banner with "Exit isolation" button |
| 11 | Spine node drag moves only its connected subset nodes | ✅ | Other spine nodes stay in place |
| 12 | Marquee selection (right-click drag) | ✅ | Badge shows count + "Generate story" / "Save JSON" |
| 13 | Edge click → open edge HUD with story bridge | ✅ | `openEdgeHud()` |
| 14 | Right-click context menu suppressed on graph | ✅ | For marquee activation |

---

## Node HUD — Four-Layer Reveal (Independent Toggles)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 15 | **Pinned concept line** — always visible, never collapses | ✅ | DeepSeek-generated on first view, refreshable, editable |
| 16 | Concept line — inline edit with Tabler `pencil` icon | ✅ | `<input>` swap, Enter to save, Escape to cancel |
| 17 | Concept line — version history (`_vh_concept`) | ✅ | All previous versions preserved in localStorage |
| 18 | **Approve / Needs work** buttons | ✅ | Persisted in triage, green/amber feedback |
| 19 | **Show full beat** — independent toggle, default collapsed | ✅ | Generated on-the-fly via DeepSeek |
| 20 | Full beat — inline edit with Tabler `pencil` icon + version history | ✅ | `_vh_fullBeat` in localStorage |
| 21 | Full beat — Regenerate button | ✅ | Re-runs DeepSeek, spinning state |
| 22 | **First principles — brute force teaching** — independent toggle, default collapsed | ✅ | MeWorld Immersa attending voice (mechanism-first) |
| 23 | First principles — version cycling (prev/next arrows) | ✅ | `wireVersionNav()` with "N of M" counter |
| 24 | Full beat — version cycling (prev/next arrows) | ✅ | Same pattern, `_vh_fullBeat` + current text |
| 25 | **Reveal the question** — independent toggle, default collapsed | ✅ | Full stem + answer choices, NOT editable |
| 26 | "Show Answer" toggle — hidden by default (study mode) | ✅ | Green badge reveals likely correct answer |
| 27 | **Related differentials** — independent toggle, default collapsed | ✅ | Same-scene peer nodes, clickable |
| 28 | Related differentials — nested inline drill-down | ✅ | Click peer → expands its concept line inline |
| 29 | Dictation panel — mic + textarea + "Compose story with AI" | ✅ | `webkitSpeechRecognition` + module `activeRecognition`; abort on `closeHud` (see Agent pitfalls) |
| 30 | Distill concept button — "what is this question teaching?" | ✅ | DeepSeek one-sentence summary |
| 31 | Milling tracker — 3-state study progress per question | ✅ | ○ untouched / ◐ partial / ● drilled, persisted in localStorage |
| 32 | **Default-collapsed guarantee** — all sections (19–28) start closed | ✅ | Fixed dock-scoping regression (`.dock-reveal-content .ind-body`) |

---

## HUD UX

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 33 | 8-way resize handles (all edges + corners) | ✅ | CSS `.rhdl-n/s/e/w/ne/nw/se/sw` |
| 34 | Draggable via drag-bar | ✅ | `makeHudDraggable()` |
| 35 | Position persisted in localStorage | ✅ | `saveHudPosition()` / `restoreHudPosition()` |
| 36 | HUD scroll (independent of graph zoom) | ✅ | `max-height: calc(100vh - 130px)`, `overflow-y: auto` |
| 37 | 40-second debounced position autosave | ✅ | `debouncedSave()` queue |
| 38 | Edge leader line from node to HUD | ✅ | SVG `<line>` element |
| 39 | **Font-size controller** — A− / 100% / A+ / ↺ in drag-bar | ✅ | MeWorld `ClinicalFontControls` pattern, range 0.8–1.6, step 0.08, `--hud-font-scale` CSS var, stored in `cgr_hud_font_scale` |
| 40 | Font-size applies to panel text only, not whole page | ✅ | Inherited via `.hud` root `font-size: calc(0.85rem * var(...))` |
| 41 | Markdown rendering — HTML-escaped first, then bold/italic/code/newlines | ✅ | `mdToHtml()`, prevents XSS |
| 42 | No click-away auto-close — panel stays until explicit ✕ click | ✅ | Removed board click listener |
| 43 | All floating UI elements draggable with persisted positions | ✅ | 11 floaters via `makeFloaterDraggable()` |

---

## Navigation

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 44 | Panel left/right arrow buttons in drag-bar | ✅ | Cycles spine nodes, disabled at ends |
| 45 | Keyboard left/right arrow cycling | ✅ | Ignores when input/textarea focused |
| 46 | Story timeline (horizontal rail at bottom) | ✅ | Coral numbered dots with dashes between |
| 47 | Timeline click-to-jump — always on | ✅ | Click any dot → immediate spine node jump |

---

## DeepSeek AI Integration

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 48 | Concept line generation (per node refresh) | ✅ | `fetchConceptLine()`, max 30 tokens |
| 49 | Full beat generation (on-the-fly, per node) | ✅ | `fetchFullBeat()`, 500 tokens, governed by `avatar-saga-story-rules-v1.md` |
| 50 | First-principles attending-voice explanation | ✅ | `fetchFirstPrinciples()` with Immersa Explainer prompt |
| 51 | Distill concept (question-level one-sentence summary) | ✅ | `distillConcept()` |
| 52 | Compose story from dictation | ✅ | Raw dictation → polished narrative |
| 53 | Generate connecting story from multi-node selection | ✅ | Marquee select + DeepSeek |
| 54 | Background pre-fetch: distill all concepts on set load | ✅ | 3 concurrent workers, skips cached |
| 55 | API key sourced from server (not exposed in frontend) | ✅ | `/api/env` from `master.env` |
| 56 | Settings popup for API key + Save/Close | ✅ | Gear icon → popup |

---

## DeepSeek Response Logging

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 57 | `POST /api/log-deepseek` endpoint | ✅ | JSONL with qid, type, prompt, response, timestamp |
| 58 | `GET /api/deepseek-log?qid=X&type=Y` endpoint | ✅ | Searches backwards for latest match |
| 59 | All 6 DeepSeek call sites log on success | ✅ | concept, fullBeat, distill, compose, generateStory, firstPrinciples |
| 60 | Frontend checks log before calling DeepSeek | ✅ | `fetchLogged()` — skip if response already exists |
| 61 | JSONL log file (`deepseek-log.jsonl`) | ✅ | Server-side persistence |

---

## Command Dock (Right-Side Slide-In Panel)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 62 | Toggle via right-edge tab button | ✅ | `layout-sidebar-right` icon, always visible |
| 63 | Resizable width (drag handle, 260–600px) | ✅ | Persisted in localStorage |
| 64 | Control replicas: set picker, Fit/Settings/Lines, legend, slider | ✅ | Synced with main controls |
| 65 | Dock stays open when clicking nodes (persistent) | ✅ | Node reveals flow into dock body |
| 66 | ← Controls button to return to dashboard | ✅ | Closes reveal view |
| 67 | Dock prev/next nav arrows + position counter (N/M) | ✅ | Spine cycling (or scene peers for non-spine) |
| 68 | Floating toolbar z-index raised + shifted when dock open | ✅ | Buttons remain accessible |

---

## Dark Mode

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 69 | Right-edge vertical strip toggle | ✅ | "DARK"/"LIGHT" label, persisted in localStorage |
| 70 | `data-theme="dark"` CSS variable overrides | ✅ | bg, ink, border, accent, coral, teal |
| 71 | Covers: graph canvas, controls, header, legend, slider | ✅ | |
| 72 | Covers: HUDs, drag-bar, concept, answers, likely badge, all buttons | ✅ | |
| 73 | Covers: edit buttons, drill items, approve/needs-work pills | ✅ | |
| 74 | Covers: first-principles, dictation, compose, dock, popups | ✅ | |

---

## Spine Concept Extractor / Reorder

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 75 | Toggle button (`list-details` icon) | ✅ | Next to Fit/Settings/Lines |
| 76 | Full-screen overlay with spine concepts in order | ✅ | Coral circles + concept text + grip icon |
| 77 | Drag-and-drop reorder (HTML5 native) | ✅ | Visual dragging + drag-over highlight |
| 78 | Non-destructive until "Apply this order" button | ✅ | Draft order preserved when toggling off/on |
| 79 | "Apply" rebuilds GRAPH.mainPath + spine rail + re-renders graph | ✅ | |
| 80 | Close via ✕, Cancel, or Escape | ✅ | |

---

## UI Polish

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 81 | Tabler icons throughout | ✅ | CDN `@tabler/icons-webfont@3.44.0` |
| 82 | No white background behind slider | ✅ | Transparent |
| 83 | No overlapping UI elements | ✅ | Z-index + spacing adjustments |
| 84 | Redundant vertical "Jump To" column removed | ✅ | Horizontal Story tracker suffices |
| 85 | Redundant bottom-left stats text removed | ✅ | Duplicated in header |
| 86 | First-use onboarding hint (auto-dismiss 30s) | ✅ | "Coral numbers = story spine in order…" |
| 87 | ResizeObserver integration for responsive graph | ✅ | D3 forces + extents update on resize |
| 88 | Start on Set 1 (auto-load) | ✅ | `loadSet(1)` on page open |
| 89 | Set dropdown labels — clean bigram phrases | ✅ | `cleanDiagnosisLabel()`, applied across all 130 sets |
| 90 | Em dashes forbidden in all AI-generated content | ✅ | Explicit instruction in DeepSeek system prompts |

---

## Server

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 91 | Node.js static file server (port 8765) | ✅ | Serves `scrape-bank/` directory |
| 92 | `/api/env` — DeepSeek key from master.env | ✅ | |
| 93 | `/api/log-deepseek` — POST JSONL logging | ✅ | |
| 94 | `/api/deepseek-log` — GET log retrieval | ✅ | |
| 95 | CORS headers on all endpoints | ✅ | |

---

## Not Yet Implemented

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 96 | Character engine (Want/Need/Flaw/Ghost) for sets 21–130 | ⚠️ Pending | Needs avatar profile data or DeepSeek-generated profiles |
| — | (All instructed features are otherwise implemented) | — | |

---

## Data Pipeline

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 97 | Scrape 50-question blocks from qb.ccscases.com | ✅ | Playwright, HTTP 429 avoidance, dedup |
| 98 | Organize scraped output into JSON | ✅ | For LLM processing |
| 99 | Generate 20 draft sets (Pattern A/B Harmon Circle) | ✅ | Standalone HTML + `sets-manifest.md` |
| 100 | Full bank spine scan — Type 1 (patient-repeat) + Type 2 (encounter) clusters | ✅ | Report for LLM review |
| 101 | `build-full-bank-graphs.js` — generate sets 21–130 | ✅ | Bigram-frequency `coreDiagnosis` labels |

---

## Agent pitfalls — DO NOT REGRESS (2026-07-21)

Three related bugs shipped and were fixed the same day. Next agents: read this before touching click, search, or mic code.

### A. Node click → HUD never opens (`ReferenceError`)

**Symptom:** Clicking spine / mimic / thread does nothing; console shows `lastHitIds is not defined` (or similar).

**Cause:** `openHud` (module scope) called symbols that lived only inside `(function initSearch(){…})()`.

**Fix / rule:** Keep these at **module level** (near `nodeSel` / `activeRecognition`):

- `let lastHitIds`
- `clearSearchHighlights()`
- `applySearchHighlights()`

Never re-declare them as IIFE-only locals. Search IIFE may *use* the module helpers.

### B. Mic works once, then dead until reload

**Cause:** Prior HUD’s `SpeechRecognition` never aborted; Chrome held the mic lock.

**Fix / rule:** Module `activeRecognition`; `closeHud()` aborts; `initRec`/`start` abort stale instances before `rec.start()`.

### C. Graph looks “dead” (dim) after search, until reload

**Cause:** `.search-dim` left on after opening a search hit; graph click did not clear.

**Fix / rule:** In `openHud`, if `event` is truthy and `lastHitIds.size`, call `clearSearchHighlights()`. Search opens pass `null` as event.

### Smoke checklist (mandatory after click / search / mic edits)

```powershell
cd C:\Users\steve\MeWorld\step3\scrape-bank
node -e "const fs=require('fs'); const h=fs.readFileSync('concept-graphs.html','utf8'); const m=h.match(/<script>([\s\S]*?)<\/script>/); new Function(m[1]); console.log('JS OK')"
```

1. Hard-refresh `http://localhost:8765/concept-graphs.html`
2. Click numbered spine, gray mimic, teal thread → HUD opens, console clean
3. Mic on node A → stop → open node B → mic works
4. Search → open hit → click another node → dim clears, HUD opens

Also documented in: `CLAUDE-HANDOFF.md` · `CURSOR-INSTRUCTIONS-CONCEPT-GRAPH.md`

---

## Full Git History

```
fe4a7a2 fix: dock-rendered node panels now respect collapsed-by-default sections (ind-body + likely)
6da0d9e feat: live-node indicator + MeWorld-style font-size controller
d431f49 feat: A/B version cycling for generated content + upgrade First Principles to Immersa attending voice
c8fc73b fix: remove click-away auto-close on node panel
c463c7e fix: dock panel covering floating toolbar buttons
aa87ead fix: secure markdown audit + collapse slash-fragment coreDiagnosis labels across all 130 sets
86002f2 feat: on-the-fly full beat generation via DeepSeek with regenerate + version history
d934830 fix: markdown rendering + em-dash prohibition + 40s debounced autosave + dock toggle unhidden
3c1145f revert: remove timeline jump-to-step toggle — always on
dd4faa9 feat: dark mode toggle + spine concept extractor with drag-and-drop reorder + apply
4cee362 feat: panel left/right arrow nav + keyboard cycling + timeline click-to-jump
54a0251 feat: inline edit with version history for concept line and full beat text
7780881 fix: HUD scroll — cap max-height, clamp resize, prevent overscroll bleed
250bc39 feat: background pre-fetch concept lines on set load — 3 concurrent DeepSeek workers
c279109 feat: DeepSeek response logging to JSONL + first-principles layer with attending voice
225805c feat: dock-as-HUD — persistent dock with node reveals + prev/next nav
505d11c docs: update manifests for 130-set coverage
76e6e45 fix: dropdown labels stuck on 'loading...'
882883a feat: complete concept graph for entire bank — 110 new sets (21–130), all 4,852 Qs covered
8c96ebf feat: unified concept graphs for all 20 sets + improved Set 2 story + smooth zoom/pan + 8-way HUD resize
```

---

## Files Summary

```
C:\Users\steve\MeWorld\step3\scrape-bank\
├── concept-graphs.html          ← Main app (~122 KB JS)
├── server.js                    ← Node.js server (port 8765, log + env endpoints)
├── deepseek-log.jsonl           ← All DeepSeek responses (server-side persistence)
├── FEATURE_CHECKLIST.md         ← This file
├── GRAPH-MANIFEST.md            ← Master manifest for all 130 sets
├── sets-manifest.md             ← Set-level metadata
├── graph-data-set-NN.json       ← 130 graph data files (nodes, edges, metadata)
├── set-NN-story-v*.html         ← 130 story HTML files
├── build-full-bank-graphs.js    ← Node.js script for generating sets 21–130
└── text-bank.json / text-bank.jsonl  ← Full text-only question bank
```
