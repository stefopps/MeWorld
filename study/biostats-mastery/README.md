# Biostats Mastery

Standalone USMLE biostatistics quiz — 179 questions, 42 pivot anchors, interactive charts.

## Quick start (other PC)

```powershell
cd study\biostats-mastery
python -m http.server 8090
```

Open **http://localhost:8090** (or double-click `START-BIOSTATS-MASTERY.bat` on Windows).

## Required files (all included)

| File | Purpose |
|------|---------|
| `index.html` | App shell + charts + chat |
| `stats_questions.json` | 179-question bank |
| `pivot_manifest.json` | 42-pivot study sequence |
| `graph_recommendations.json` | Chart type assignments |
| `pygmalion-pig-chess.png` | Concept image (Pygmalion trap) |
| `rules.mdc` | Pivot / graph rules |
| `START-BIOSTATS-MASTERY.bat` | One-click local server |

## Settings

- Gear icon → slide-out panel: Export/Import, font size, **DeepSeek API key** for Immersa chat (stored in browser localStorage only — never committed).

## Optional dev smoke tests

```powershell
npm install
node browser-smoke.mjs
```
