# ECG Vector Lab — Agent handoff (Manus / next session)

**Last updated:** 2026-06-15 · **Branch:** `main` on `meworld` remote  
**Owner:** Steve — immersive hexaxial study tool + Kojo body plates

## Start here

| What | Path / command |
|------|----------------|
| **Main app** | `C:\Users\steve\MeWorld\game\ecg-vector-lab.html` |
| **Dev URL** | `http://localhost:5173/ecg-vector-lab.html` (**5173 only** — other ports = different localStorage) |
| **Launch** | `cd MeWorld\game` → `npm run dev` |
| **This doc** | `ECG_VECTOR_LAB_HANDOFF.md` |
| **Incremental revert** | `docs/ECG_LAB_INCREMENTAL_REVERT.md` |
| **Magnific pipeline** | `assets/ecg-vector-lab/character/MAGNIFIC_CARDIOCARD_PIPELINE.md` |

### Smoke / verify before changing draw code

```powershell
cd "C:\Users\steve\MeWorld\game"
npm run dev   # keep Vite on 5173

node scripts/smoke-ecg-vector-lab.mjs
node scripts/capture-ecg-vector-lab-smoke.mjs   # optional PNG captures
```

Visual PNGs: `docs/smoke-screenshots/<YYYY-MM-DD>/`

---

## Steve-approved body plates (do not regress)

| Plate | File | Use |
|-------|------|-----|
| **CardioCard angle** (default) | `assets/ecg-vector-lab/character/kojo-cardiocard-angle.png` | Ref-04 pose + Kojo face — **Steve pick (2026-06-15)**. Promoted from Magnific B pick. |
| **Gray full body** | `assets/ecg-vector-lab/character/kojo-gray-avatar-full.png` | Matte gray full-body manikin — **Steve likes (2026-06-15)**. Pick **Gray B** in body look cycle for tuned layout. |

**A/B archives (reference only):**

- `kojo-cardiocard-angle-a.png`, `kojo-cardiocard-angle-b.png` — Magnific regen picks; canonical runtime = `kojo-cardiocard-angle.png`
- `kojo-gray-avatar-full-a.png`, `kojo-gray-avatar-full-b.png` — gray variants; bundled layout uses **gray-b** JSON

**Body look UI:** Real mode → **Angle** | **Gray B** buttons (`BODY_PLATE_CATALOG`, `setBodyPlateId()`).

**Do not:**

- Overlay ref 04 colored dots at runtime (pose ref only — see pipeline doc)
- Composite random PNG chains as “the product body”
- Replace approved plates without Steve sign-off

---

## Architecture (layers)

| Layer | Source | Toggle |
|-------|--------|--------|
| **Body plate** | Approved PNG above | Real mode + body look |
| **Heart** | SVG heart pack (`heart-1` / `heart-2`) | ♥ Heart |
| **Ribs** | SVG `rib-cage-anterior-data.js` | ⌗ Ribs |
| **Einthoven triangle** | Engine math on electrode positions | △ Einthoven |
| **Hexaxial scope ring** | **Measured** from electrode geometry (`computeLeadModel()` / `LEAD_MODEL`) — ring ticks follow triangle | ◎ Scope |
| **Net QRS vector** | Simulated axis + comet trail | → Vector · ✦ Comet |
| **Lead flow pulses** | Green (−) → red (+) teardrop along body wires + ring | ⚡ Flow |
| **Conduction study** | Pathway glow + P/QRS/T vector loops (`ecg-conduction-model.js`) | **Lab \| Conduction** |
| **3D view** | `assets/ecg-vector-lab/ecg-scene-3d.js` (Three.js CDN) — measured scope axes + heart anchor/scale/rotation sync | 2D \| 3D + ○ Ring · ◔ V fan |

**Teaching note:** Scope ring ticks now **match measured limb vectors** from RA/LA/LL positions. Textbook angles (I=0°, II=60°, III=120°…) remain in readout as reference via `CANONICAL_LEAD_DEG`. Angled body plate vs textbook is intentional when electrodes are moved.

Ref index: `assets/ecg-vector-lab/references/REFERENCES_INDEX.md`  
2D notes: `assets/ecg-vector-lab/ARCHITECTURE-2D.md`

---

## Immersive study (Steve request)

| Action | How |
|--------|-----|
| **See current along each lead** | Layer **⚡ Flow** — green (−) → red (+) teardrop on body wires + scope ring |
| **Solo one lead** | Click **I…aVF** on scope/triangle · Lead pills · strip row tap · keys **1–6** · **Solo focus** |
| **Show all leads** | Lead toolbar **All** · HUD **Show all** chip when isolated |
| **Conduction + vectorscope** | Bottom **Lab \| Conduction** — left pathway glow, right P/QRS/T loops (tunable preset in Controls) |
| **Collapsible Controls** | Plate BG · Scope size · Badge size/spread · Canvas colors · Conduction model — state in `ui.controlsSections` |
| **Zoom chest for V1–V6** | Scroll on body canvas · middle-drag pan · dbl-click reset · Ctrl+scroll = scope ring size |
| **Placement mode** | Controls → 📍 12-lead · scroll zoom chest · drag electrodes |

Code: `computeLeadModel()`, `drawLeadFlowTeardrop()`, `drawConductionMode()`, `hitStudyLead()`, `isolateLead()`, `initCtlSections()`, `LEAD_STUDY`, `zoomBodyViewFromWheel()`.

---

## Layout persistence

| Item | Detail |
|------|--------|
| **Browser key** | `localStorage` `ecgVectorLabLayoutV1` |
| **Bundled default** | `assets/ecg-vector-lab-user-layout.json` |
| **Per-plate auto-load** | `BODY_PLATE_LAYOUTS` → angle: `layouts/cardiocard-angle-layout.json` · **16:9: `layouts/cardiocard-angle-16x9-layout.json` (Layout 9 — Steve QA 2026-06-14)** · gray-*: `layouts/gray-b-layout.json` |
| **Layout 8** | Standard angle plate — Heart 1, 131%, −10°; scope on chest | `apply-ecg-angle-layout8.mjs` |
| **Layout 9** | **16:9 wide plate — Steve export** — limb electrodes retuned, scope 60%, heart 82%, bodyView zoom ~174% + pan | `layouts/cardiocard-angle-16x9-layout.json` |

**Apply / revert layout 6 without touching HTML:**

```powershell
cd MeWorld\game
node scripts/apply-ecg-angle-layout6.mjs
node scripts/revert-ecg-angle-layout6.mjs
```

Backup: `assets/ecg-vector-lab-user-layout.backup-pre-layout6.json`

**Marker defaults:** `CARDIOCARD_NORM` in `ecg-vector-lab.html` — aligned to layout 6 (not raw ref-04 template).

---

## Clinical strip

- **PTB-XL sample:** `assets/ecg-ptbxl-00001-limb-leads.json` · export script `scripts/export_ptbxl_limb_ecg.py`
- Toggle: clinical real ECG on strip ( bundled layout `useRealEcg: true`)

---

## 3D / personalized mesh (future)

| Asset | Path |
|-------|------|
| Procedural + optional GLB | `ecg-scene-3d.js` · `character/boy.glb` |
| Meshy workflow | `character/MESHY_WORKFLOW.md` · `scripts/meshy-boy-image-to-3d.mjs` |
| Anchors template | `character/anchors.json` |

**Steve direction:** Nano Banana / Magnific plate → segment heart + ribs → image-to-3D → anchor electrodes per person. 3D toggle exists; organ-specific meshes per character = next pipeline step.

---

## Key code map

| Feature | Symbols / location |
|---------|-------------------|
| State `S` | `var S={...}` |
| Body plate | `BODY_PLATE_CATALOG`, `loadActiveBodyPlate()`, `drawBodyPrimary()` |
| Hexaxial degrees | `CANONICAL_LEAD_DEG`, `scopePtFromDeg()`, `leadElectricalVec()` |
| Measured vs canonical | `MEASURED_LEAD_AXES` (body triangle angles) vs ring (fixed) |
| Lead isolation | `isolateLead()`, `initLeadPills()`, `visibleLeadsList()` |
| Lead flow animation | `drawLeadFlowLayer()`, `S.showLeadFlow` |
| Body view zoom | `bodyViewZoom`, `zoomBodyViewFromWheel()`, `initBodyViewPan()` |
| 3D sync | `ensureScene3d()`, `syncScene3dFromLab()`, `buildLab3dPayload()` |
| Persistence | `loadInitialLayout`, `applyLabLayout`, `saveLabLayout`, `setBodyPlateId()` |

---

## Git (incremental revert)

Recent ECG commits on `main` (newest first):

| Commit | Contents |
|--------|----------|
| `e97b171` | Revert doc commit hashes |
| `18f0273` | App: scroll zoom, 3D, layout 6 wiring, lead flow (if pushed after local work) |
| `a097b8d` | Asset pack + character PNGs + layouts + PTB-XL |
| `20cd7a5` | Apply/revert layout scripts + backup |

See `docs/ECG_LAB_INCREMENTAL_REVERT.md` for `git revert` order.

**Remote:** `meworld` → `https://github.com/stefopps/MeWorld.git`

---

## Open / next for Manus

1. **Wire catalog default** — confirm `kojo-cardiocard-angle.png` loads on fresh boot (Steve-approved).
2. **Layout 9 (16:9)** — bundled at `layouts/cardiocard-angle-16x9-layout.json` from Steve export `ecg-vector-lab-layout (2026-06-14).json`.
3. **Vision landmarks** — wire `detectPlateLandmarksFromVision()` per new character plate (`character/ANCHOR_VISION_PIPELINE.md`). Meshy / segment pipeline **deferred**.
4. **Optional:** “Frontal vs body angle” readout when Angle plate selected (reduces II/III confusion).
5. **Git commit** — MeWorld branch is ahead of remote; commit after Steve sign-off on Layout 9.
6. Update stale sections in `ECG_VECTOR_LAB_SPEC.md` if still referenced.

### ECG Morph Explorer (2026-08-04) — working prototype for concept-graphs

A standalone interactive ECG waveform morph tool now exists at `step3/scrape-bank/ecg-morph.html`. It handles the “normal → abnormal” teaching mechanic as a simpler, embeddable component:

- **RBBB mode:** single-lead trace with clickable P/PR/QRS/T/R' zones, draggable HUD explanations
- **LBBB mode:** dual-lead V1+V6 with annotation toggle (deep S wave arrow, broad notched R arrow)
- Smooth slider-based linear interpolation between point arrays (no jump-cuts)
- Built to concept-graphs visual tokens (ready to embed as iframe/panel)
- Config-driven: add new morph pairs by extending the CONFIGS object

**Relationship to ECG Vector Lab:** The morph explorer is the “first principles” teaching layer. The Vector Lab is the immersive hexaxial + vectorscope + body-plate study tool. They serve different depths — morph explains *what changes* in the waveform; Vector Lab explains *why* through conduction pathways and electrical axis. The morph tool is the on-ramp; Vector Lab is the deep dive.

### Shipped after original Phases 0–5 (2026-06-14 session)

| Feature | What it does |
|---------|----------------|
| **Live projection construction** | Solo one lead → dashed perpendicular from vector arrow to axis foot, synced to strip playhead |
| **P/QRS/T loop trails** | Comet layer traces phase-colored vectorcardiogram loops |
| **Triangle→ring ghost** | Isolating I/II/III animates Einthoven side sliding to hexaxial ray |
| **aVR callout** | HUD chip when aVR isolated: normally inverted |
| **3D V fan fix** | V1–V6 on chest surface (`PRE_BODY`), not flat disc behind body |
| **Plate boundary + anchors** | Photo fits body box; **Link to plate** / **Auto-fit now**; dynamic clamp |
| **Layout 9** | Steve-tuned 16:9 — limbs, scope 60%, heart 82%, chest zoom/pan |

---

## UX reminders

- **RL:** ground reference only — not in I/II/III math (`SHOW_RL_REF=false`).
- **Ref 04:** Magnific pose + default anchors only — **no runtime overlay**.
- **Port 5173:** layout + localStorage tied to this origin.
- **MeWorld React app:** separate — if editing differential/CSS see `CURSOR_RULES.md`; ECG lab is standalone HTML on same Vite server.
