# Biostats Mastery — Pictogram Purple Highlight Style Lock

**Reference image:** `references/iconography/style-pictogram-reference.png`

> Flat, monochrome (single-hue purple + black) pictogram style. Not editorial illustration — this is the icon-grid card style for concept diagrams like 2×2 tables, Sn/Sp grids, and test-outcome comparisons.

---

## Quick summary — plain language

Flat, line-art human figures with a very specific stylized proportion: **oversized round head, long thin torso, notably short stubby legs/feet** — almost paper-doll-like, not naturalistic. A soft-edged translucent purple "highlight" shape sits behind whichever figures are being called out, and those same figures switch from white/outline to solid filled purple. Consistent numbered-card grid layout, one-line plain-English caption under each icon, small symbol accents (skull, heart, checkmark, exclamation, door frame) doing the conceptual heavy lifting instead of literal illustration.

---

## When to use this style

| Concept type | Example |
|---|---|
| 2×2 contingency tables | TP/FP/FN/TN grids with patient icons |
| Sn/Sp concept diagrams | "Which patients test positive?" |
| PPV/NPV walkthroughs | Patient cohort → test → outcome |
| Empiric rule grids | ±1σ / ±2σ / ±3σ percentage breakdowns |
| Diagnostic threshold metaphors | Doorway/frame cutoff visuals |
| Before/after comparisons | Arrow between two icon groups |

**Not for:** main PPV curves, ROC plots, forest plots, normal distributions — those stay in the existing `Minimal Editorial Medical Concept Illustration` style (`STYLE_LOCK.md`).

---

## Color palette

| Element | Color |
|--------|-------|
| Baseline / unselected figures | Black or near-black stroke (`#111111`), white/transparent fill |
| Called-out / selected figures | Solid purple (`#8b5cf6` to `#7c3aed`), NO stroke |
| Highlight overlay behind called-out figures | Same purple, 15-25% opacity, soft rounded blob/capsule shape |
| Text | Bold dark for titles, muted dark gray for captions |
| Background | Solid white |
| **No other colors** | One hue only + black/gray |

---

## Figure proportions — THE signature trait

| Part | Rule |
|------|------|
| **Head** | Simple circle, unfilled outline (never filled, even when body is solid), proportionally LARGE relative to body |
| **Torso** | Long, narrow, gently tapered rounded rectangle — reads as "thin and light" |
| **Arms** | Omitted or minimal — implied by torso silhouette only |
| **Legs and feet** | **CRITICAL:** very short and stubby relative to torso length. Torso occupies most of the figure height, legs/feet compress into a small base. NOT naturalistic — closer to paper-doll or bowling-pin silhouette than an anatomical figure |
| **Stroke** | Uniform thin line weight, consistent across every icon in the set |
| **Corners** | Soft rounded, no sharp angles |

**Do not drift toward "normal person" proportions.** The stubby-leg/long-torso silhouette is what makes this style recognizable.

---

## Composition rules

- **3-6 figures per icon**, in a single horizontal row (two rows only for before/after)
- Called-out subset: ALWAYS both solid-purple fill + highlight-blob overlay — never one without the other
- **Identical figure silhouette** reused across all icons in the set — only fill state and grouping change
- Grid layout: numbered card → icon → single-line caption

---

## Symbol library

| Concept | Symbol |
|--------|--------|
| Positive/healthy status | Circle badge with checkmark above figure's head |
| Warning/flagged | Circle badge with exclamation mark |
| Group → outcome connector | Thin black bracket/brace line |
| Positive/survival outcome | Heart icon |
| Negative/death outcome | Skull icon |
| Medical/diagnosed | Plus/cross marker |
| Diagnostic threshold / cutoff | Doorway/frame shape figure walks through |
| Before/after progression | Simple arrow between two icon groups |

---

## Negative constraints

These are FORBIDDEN in this style:

- No anatomical detail (no fingers, faces, clothing texture)
- No drop shadows
- No outlines on solid-fill purple figures
- No secondary colors beyond the single purple hue and black/gray text
- No photorealistic or 3D rendering

---

## Relationship to other styles

| Style | File | Use for |
|-------|------|---------|
| **Minimal Editorial Medical Concept Illustration** | `STYLE_LOCK.md` | Main graphs, PPV/ROC curves, forest plots, concept illustrations |
| **3D Concept Icon Style** | `3D_STYLE_LOCK.md` | 3D rendered character icons for teaching statistics (rare) |
| **Flat Pictogram Purple Highlight** | This file | Icon-grid card layouts: Sn/Sp grids, 2×2 tables, threshold diagrams |
