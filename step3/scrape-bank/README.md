# CCS QB scrape bank

Canonical home for scraped question-block JSON from qb.ccscases.com.

| Folder | Contents |
|--------|----------|
| `raw/` | Playwright scrape JSON (blocks 1–119) |
| `exports/` | Post-processed PNGs + linked JSON (junction to `../scrape-export`) |
| `recordings/` | Handoff click timings |
| `logs/` | Pool counter log |

Start here: **[CLAUDE-HANDOFF.md](./CLAUDE-HANDOFF.md)** · **[manifest.json](./manifest.json)**

**Concept graphs:** `concept-graphs.html` + `server.js` (`:8765`). Before editing clicks / search / mic, read **Agent pitfalls** in [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) and [CLAUDE-HANDOFF.md](./CLAUDE-HANDOFF.md) (module scope vs IIFE — broken node clicks).
