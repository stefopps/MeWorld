# Cursor Instructions — Force-Directed Concept Graph Generator

## Goal
Generate a standalone interactive force-directed graph (like the D3 network reference) for each
set, showing how that set's 40 questions cluster by scene and thread together by diagnostic
category. One HTML file per set. The proven Set 1 version is the template, match its structure.

## Step 0 — Source the data (GitHub first)
Before generating anything, check whether a repo already exists for this project on GitHub.
- If a repo exists: pull the set HTML files from it (the `set-0N-story-v*.html` files that
  already contain the real `ITEMS` arrays). Do not regenerate question data, read it from those
  files. Use the existing repo as the single source of truth.
- If no repo exists: fall back to the local `set-0N-story-v*.html` files in the working
  directory. Flag that no repo was found so Master can decide whether to create one.
- Never invent or scrape new question content for this. The graph is a VIEW over existing data,
  it does not create data.

## Step 1 — Extract per-set graph data
For each set's HTML file, parse the `const ITEMS = [...]` array. For every question pull:
`id`, `sceneId`, `indexInScene`, the first ~70 chars of `question` (for the hover tooltip),
and the full `explanation` (for the set-level metadata — see Step 5 output schema).

## Step 2 — Classify each question into a category
Each node needs a category that determines its color. Three categories, same as Set 1:
- `primary` — the question actually confirms/represents the set's core diagnosis (the disease
  the saga's avatar really has in this set)
- `mimic` — a look-alike / distractor / differential that is NOT the core diagnosis
- `thread` — belongs to a recurring cross-scene look-alike thread (e.g. the systemic sclerosis
  thread in Set 1 that resurfaces in multiple scenes)

Classification source of truth, in priority order:
1. If the set's metaphor table or story data already tags which questions are the avatar's real
   diagnosis vs comparison cases, use that tagging directly.
2. Otherwise, derive it from the `likely`/correct-answer field plus the scene differential
   labels in the manifest. Do not guess from the stem text alone if a tagged source exists.
3. If a set genuinely has no second recurring thread, omit the `thread` category for that set,
   two categories is fine. Do not invent a thread to fill the legend.

Output a small `graph-data-set-0N.json` per set so the classification is inspectable and Master
can correct it before it's baked into the visual.

## Step 3 — Build edges
Two edge kinds, same as Set 1:
- `scene` edges: full mesh within each scene (every question connects to the other 7 in its
  scene). Thin, low opacity, neutral gray. This creates the 5 local clumps.
- `thread` edges: full mesh among all `primary` nodes across the whole set (the avatar's real
  disease connecting scene to scene), and separately a full mesh among all `thread` nodes.
  Colored to match the category, slightly stronger than scene edges.

## Step 4 — Render (clone the Set 1 template exactly)
Use the Set 1 graph widget as the literal template. D3 v7 force simulation, same forces:
- `forceLink` distance ~34 for scene edges, ~70 for thread edges; strength 0.7 scene / 0.15 thread
- `forceManyBody` strength -60, `forceCenter`, `forceCollide` radius 10
- Node radius 6, colored by category, hover tooltip showing scene + category + stem snippet
- Click a node → `sendPrompt` asking to go deeper on that question
- Same 3-item color legend at the top (primary / mimic / thread)
Do not redesign the visual. Only the data changes per set.

## Step 5 — Output
- One `set-0N-concept-graph.html` per set, standalone, D3 loaded from cdnjs
- The per-set `graph-data-set-0N.json` alongside it
- A short `graph-manifest.md`: per set, the category counts (how many primary / mimic / thread),
  so Master can sanity-check that each set is differential-heavy (mostly mimic) rather than
  secretly being the same diagnosis 40 times. A set that comes out 35 primary / 5 mimic is a
  red flag the clustering collapsed, flag it.

### `graph-data-set-N.json` schema

```json
{
  "set": 74,
  "storyFile": "set-74-story-va.html",
  "source": "auto-classified: …",
  "repo": "…",
  "coreDiagnosis": "Atopic Dermatitis · Topical Retinoid",
  "recurringThread": "",
  "mainPath": ["2164", "2342", "2397", "2409"],
  "generatedAt": "2026-07-13T13:05:43.447Z",
  "counts": { "primary": 4, "mimic": 36, "thread": 4 },
  "character": { "name": "David", "age": 44, … },
  "image": "images/tmj-accountant-bruxism-2409.jpg",
  "explanation": "Explanation This patient with referred otalgia…TMD commonly causes…",
  "nodes": [ … ],
  "edges": [ … ]
}
```

| Field | Source | Notes |
|-------|--------|-------|
| `image` | Auto-wired by `server.js` `/api/append-img` | Relative path under `images/`. Rendered as the set cover in `concept-graphs.html` via `updateCover()`. |
| `explanation` | Extracted from the story HTML's `ITEMS` array | The answer-key explanation for the canonical/primary node. Auto-wired by `/api/append-img` when the image name includes a trailing node ID (e.g. `…-2409.jpg`). If the image was placed manually, copy the explanation field from the story file's `ITEMS[].explanation` for the node matching the set's primary diagnosis. Used by the attending voice (Dr. Iwu) as seed context — the frontend (`loadSet`) does NOT currently read `meta.explanation`; it lives at the per-node level. A future agent should plumb it into the chat context block in `sendChat()`. |

## Guardrails
- Data is a view, never a source. Pull from the repo (or local files); never regenerate questions.
- Classification gets its own inspectable JSON before it's rendered, so it can be corrected.
- Clone the Set 1 visual exactly, don't restyle per set.
- If the GitHub repo and local files disagree, stop and ask which is canonical rather than
  picking one silently.
- Round any displayed counts; no floats.

## Runtime pitfalls (`concept-graphs.html`) — DO NOT REGRESS

These are live bugs that already shipped once. Read before editing click, search, or mic code.

### Module scope vs search IIFE

`openHud` / graph node `.on('click')` run at **module scope**. Search lives in `(function initSearch(){…})()`.

- **Never** reference `lastHitIds`, `clearSearchHighlights`, or `applySearchHighlights` from `openHud` unless they are declared at **module level** (they are, near `activeRecognition`).
- **Never** re-declare those as `let` / `function` only inside `initSearch` — that shadows module state and can make module callers throw `ReferenceError`, which silently kills node clicks (HUD never opens).
- IIFE may call module-level helpers; module code must not depend on IIFE locals.

### Mic across HUD switches

- Module `activeRecognition` tracks the live `SpeechRecognition`.
- `closeHud()` must `abort()` it so Chrome releases the mic.
- `initRec()` / `start()` must abort any stale recognition before starting a new one.
- Without this, mic works on the first node and dies until page reload after switching nodes.

### Search highlight clear on graph click

- Direct node clicks (`event` truthy): clear `.search-dim` via `clearSearchHighlights()`.
- Programmatic opens from search (`openHud(node, null)`): leave highlights until the user clicks the graph.

### Smoke after any click/mic/search edit

1. `node -e` syntax-check the main `<script>` block (see `CLAUDE-HANDOFF.md` § Concept-graphs agent pitfalls).
2. Hard-refresh `http://localhost:8765/concept-graphs.html`.
3. Click spine / mimic / thread → HUD opens, console clean.
4. Mic on node A → stop → open node B → mic starts again.
5. Search a QID → open hit → click another node → dim clears, HUD opens.
