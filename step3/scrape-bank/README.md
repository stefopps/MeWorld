# CCS QB scrape bank + Concept Graphs

Canonical home for scraped question-block JSON from qb.ccscases.com, plus the concept-graphs visual explorer and interactive ECG morph tool.

| Folder | Contents |
|--------|----------|
| `raw/` | Playwright scrape JSON (blocks 1–119) |
| `exports/` | Post-processed PNGs + linked JSON (junction to `../scrape-export`) |
| `recordings/` | Handoff click timings |
| `logs/` | Pool counter log |

Start here: **[AGENTS.md](./AGENTS.md)** (current state + pending) · **[CLAUDE-HANDOFF.md](./CLAUDE-HANDOFF.md)** · **[manifest.json](./manifest.json)**

**Concept graphs:** `concept-graphs.html` + `server.js` (`:8765`). Before editing clicks / search / mic, read **Agent pitfalls** in [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) and [CLAUDE-HANDOFF.md](./CLAUDE-HANDOFF.md) (module scope vs IIFE — broken node clicks).

## Interactive tools (standalone HTML)

| File | Purpose |
|------|---------|
| **[concept-graphs.html](./concept-graphs.html)** | D3 force-graph explorer — Sets 1–20 cluster viz, search, isolation, story spine |
| **[ecg-morph.html](./ecg-morph.html)** | ECG waveform morph explorer — Normal → RBBB / LBBB with live slider, clickable trace segments, draggable explanation HUD. Designed to embed into concept-graphs as a reusable component. See CONFIG object at top of script for adding new waveform pairs. |
