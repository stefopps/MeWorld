# Agent handoff — Scrape Bank / Concept Graphs

**Repo:** `stefopps/MeWorld` → `step3/scrape-bank/`  
**Last commit:** `b5b3d1c` (2026-07-21) — node-click/mic/search fixes + Set 74 TMJ cover  
**Latest uncommitted:** Notes/Chat panel dimension persistence across dock/undock + session restarts (2026-07-21)  
**Server:** `node server.js` → http://localhost:8765/concept-graphs.html

## Quick start

```powershell
cd C:\Users\steve\MeWorld\step3\scrape-bank
node server.js
# Open: http://localhost:8765/concept-graphs.html
```

---

## What this session did (2026-07-21)

### 1. Q111 Pedigree Inheritance Lab

**File:** `reference/free137/q111-pedigree-interactive.html`

A standalone interactive pedigree tool for Free 137 Q111 (indeterminant inheritance pattern). Features:

- Single step showing all 5 answer choices (A–E) simultaneously
- Click any choice → pedigree re-highlights with green (supporting) / red (contradicting) nodes
- Click any person → blurb updates to explain relevance to the currently-selected choice
- **"First principles" panel** (`fp-panel`) wired to Dr. Iwu attending voice
  - `loadMainFirstPrinciples()` — fetches FP prose from `concept-graphs.html` localStorage or server
  - `askAttendingFocus()` — queries DeepSeek via `server.js` proxy with pedigree-focused prompts
- Uses `server.js` endpoints: `/api/load-triage`, `/api/deepseek-log`

**Wired into concept-graphs.html:**

```javascript
// FREE137_DATA node (Q111):
{
  id: 'q111_pedigree_inheritance_indeterminant',
  pedigreeLab: 'reference/free137/q111-pedigree-interactive.html',
  pedigreeTeach: { approvedLesson: false, origin: 'I-2', proband: 'IV-2', ... }
}
```

- `questionHTML()` shows "Open pedigree lab" link
- `sendChat()` and `fetchFirstPrinciples()` inject `formatPedigreeTeachBlock(node)` into DeepSeek context
- **Status:** Q111 lab works standalone. Dr. Iwu voice wired. Waiting for Steve approval before generalizing to other pedigree questions.

### 2. Set 74 TMJ Cover + Explanation

**Portrait:** `images/tmj-accountant-bruxism-2409.jpg` (99 KB)  
**Source:** `reference/case-portraits/tmj-accountant-bruxism-2409.jpg`  
**Wired to:** `graph-data-set-74.json`

```json
{
  "image": "images/tmj-accountant-bruxism-2409.jpg",
  "explanation": "Explanation This patient with referred otalgia…" // 2074 chars
}
```

- `updateCover()` in concept-graphs.html renders `meta.image` as set cover
- `meta.explanation` exists in JSON but `loadSet()` does **NOT yet consume it** — a future agent should plumb it into `sendChat()` context

### 3. `/api/append-img` now auto-wires explanations

`server.js` line 557+ — when image name ends in a node ID (e.g. `…-2409.jpg`), the endpoint:
1. Copies image to `images/`
2. Sets `graphData.image`
3. Searches `set-NN-story-va.html` for `ITEMS[]` matching the node ID
4. Copies that node's `explanation` field into `graphData.explanation`

### 4. Bug fixes (pushed to main)

| Bug | Cause | Fix |
|-----|-------|-----|
| Node clicks dead → HUD never opens | `openHud` referenced `lastHitIds` / `clearSearchHighlights` declared inside search IIFE → `ReferenceError` | Hoisted both to module scope (near `activeRecognition`) |
| Mic works once, then dead after switching nodes | Prior HUD's `SpeechRecognition` never aborted; Chrome held mic lock | `closeHud()` aborts `activeRecognition`; `initRec`/`start` abort stale instances |
| Search dim sticks after graph click | `.search-dim` opacity 0.22 left on from search; clicking graph did not clear | `openHud` calls `clearSearchHighlights()` when `event` is truthy |

### 5. Agent pitfall docs written

Four files updated with "DO NOT REGRESS" sections:
- `FEATURE_CHECKLIST.md` — Agent pitfalls A/B/C + smoke checklist
- `CLAUDE-HANDOFF.md` — Concept-graphs agent pitfalls + scope rules
- `CURSOR-INSTRUCTIONS-CONCEPT-GRAPH.md` — Runtime pitfalls under Guardrails
- `README.md` — Pointer to pitfalls before editing

### 5b. Notes/Chat panel dimension persistence (2026-07-21, uncommitted)

The Notes & Chat panel (dict-sect) now retains its resized width across dock ↔ undock transitions and across session restarts.

**How it works:**
- Shared localStorage key: `cg-notes-panel-dims` ({ width, docked })
- `saveHudPosition()` (HUD resize end) → `mergeNotesPanelDims({ width, docked: true })`
- `wireFloaterResize` onUp (float resize end) → `mergeNotesPanelDims({ width, docked: false })`
- `makeFloaterDraggable` onUp (float drag end) → also writes to shared key
- `restoreHudPosition()`: per-node `hud-pos-*` wins; fallback reads `cg-notes-panel-dims`
- `createFloatingDict()`: per-node `float-dict-pos-*` wins; fallback reads shared key
- `destroyFloatingDict()` (redock): saves float width to shared key, applies to parent HUD immediately, calls `saveHudPosition(parent)` for per-node persistence

**Touch points:** `saveHudPosition`, `makeFloaterDraggable` onUp, `wireFloaterResize` onUp, `restoreHudPosition`, `createFloatingDict`, `destroyFloatingDict`

**Do not regress:** If you add a new HUD creation path that doesn't call `restoreHudPosition`, the shared key won't be read and the panel will use the CSS default (340px float / 420px HUD).

---

## Architecture — concept-graphs.html module scope map

```
Module-level globals (everything outside IIFEs):
  activeRecognition   — SpeechRecognition instance (abort on closeHud)
  lastHitIds          — Set of search-highlight node IDs
  nodeSel             — D3 node selection
  linkSel             — D3 link selection
  isolatedNodeId      — Ctrl+click isolation mode
  currentLiveNodeId   — Which node's HUD is open
  GRAPH               — { nodes, edges, mainPath, setId, counts }

Module-level functions (callable from anywhere):
  openHud(d, event)   — open floating panel for node d
  closeHud()          — remove HUD + abort mic + clear live ring
  clearSearchHighlights()  — clear .search-dim
  applySearchHighlights(ids) — apply .search-hit / .search-dim
  updateLiveNodeIndicator()
  markProgress(d)
  findNodeById(id)
  readNotesPanelDims() / writeNotesPanelDims() / mergeNotesPanelDims() — cross-mode panel size persistence

IIFE: (function initSearch() { … })()  — search input + result rendering
  - Calls module helpers: clearSearchHighlights, applySearchHighlights
  - Module code must NOT depend on IIFE locals (hlIdx, matches, debounceTid)
```

---

## Server (server.js)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/append-img` | POST | Copy image + link to set; auto-wires explanation from story file |
| `/api/load-triage` | GET | Fetch triage data for a node (used by pedigree lab) |
| `/api/deepseek-log` | GET | Fetch DeepSeek chat logs |
| `/api/find-node` | GET | Look up which set a QID lives in |
| `/api/notes` | GET/PUT | Global notes sync |
| `/api/generate-concept` | POST | DeepSeek → OpenAI DALL-E concept images |
| Static files | GET | Serves all files in `scrape-bank/` on `:8765` |

---

## Key paths

| Path | Role |
|------|------|
| `concept-graphs.html` | Main app (~635 KB, all in one file) |
| `server.js` | Node.js static + API server (`:8765`) |
| `images/` | Per-set cover images (served as `/images/…`) |
| `reference/` | Reference assets — case portraits, Free 137 PDFs, pedigree lab |
| `reference/free137/` | Free 137 Q111 pedigree lab + _* debug scripts |
| `user-data/` | User sessions — notes, chats, triage (gitignored, served by server) |
| `output-recluster/` | Older cluster output |
| `claude-handoff/` | Older handoff docs |

## Pending / not yet done

1. **Plumb `meta.explanation` into `sendChat()` context** — the data exists in `graph-data-set-74.json` (and future sets via `/api/append-img` autowire), but `loadSet()` / `sendChat()` don't read `meta.explanation` yet.
2. **Generalize Q111 pedigree lab** — currently one-off for Q111. If Steve approves, make it reusable for all pedigree questions (at minimum Q121 `q121_pedigree_x_linked_recessive` which already has a `pedigreeTeach` field skeleton in FREE137_DATA).
3. **Set 74 `coreDiagnosis` label is wrong** — says "Atopic Dermatitis · Topical Retinoid" but the canonical node is 2409 (TMJ disorder). Regenerate with `build-smart-graphs.js` or fix manually.
4. **Dr. Iwu pedigree teaching not yet tested end-to-end** — `fp-panel` in the pedigree lab should load FP from concept-graphs, but this needs both apps running (`:8765` server) and may need localStorage hydration.

## Smoke checklist (before shipping edits)

```powershell
cd C:\Users\steve\MeWorld\step3\scrape-bank
node -e "const fs=require('fs'); const h=fs.readFileSync('concept-graphs.html','utf8'); const m=h.match(/<script>([\s\S]*?)<\/script>/); new Function(m[1]); console.log('JS OK')"
```

1. `node server.js` → `http://localhost:8765/concept-graphs.html`
2. Click spine node → HUD opens, console clean
3. Click mimic → HUD opens
4. Click thread → HUD opens
5. Mic: start → speak → stop (notes saved); open another node → mic works
6. Search → open result → click graph node → dim clears, HUD opens
7. Set 74 → portrait appears in header; click any node works
8. Q111 → "Open pedigree lab" link works → lab loads → click choices → highlights + FP panel
9. Notes/Chat panel resize → undock → verify width persists → resize in float mode → redock → verify width persists on HUD
10. Close tab → reopen → click node → panel opens at last saved width (not 340px/420px default)