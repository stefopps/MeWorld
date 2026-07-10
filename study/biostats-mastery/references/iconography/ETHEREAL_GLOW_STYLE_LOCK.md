# Biostats Mastery — Ethereal Minimal Glow Style Lock

> Monochromatic black-and-white 3D editorial illustration. Faceless glowing humanoid mannequins floating in a black void — holographic, volumetric, premium.

**JSON spec:** `references/iconography/ethereal-glow-lock.json`

---

## When to use this style

| Concept type | Example |
|---|---|
| Disease mechanism illustrations | "How a biomarker travels from organ to bloodstream" |
| Physiological metaphors | "The brain's threshold gate opening/closing" |
| Drug mechanism of action | "Where does this receptor antagonist bind?" |
| Clinical staging / progression | "Cancer spreads from primary → lymph node → distant organ" |
| Abstract statistical concepts | "Power is a spotlight — how much of the effect does it illuminate?" |
| Chapter openers / hero visuals | Full-page editorial art introducing a concept section |

**Not for:** Data-driven charts (PPV curves, forest plots, ROC), 2×2 tables, Sn/Sp grids, option buttons — those use the other style locks.

---

## Core identity

| Property | Value |
|----------|-------|
| **Background** | `#050505` — empty black void, no gradient, no texture |
| **Subject light** | Volumetric rim lighting, soft bloom halo around every silhouette |
| **Material** | Smooth matte plastic, zero texture, high roughness, minimal reflection |
| **Figures** | Faceless mannequins — no facial features, no clothing, rounded simplified anatomy, gender neutral |
| **Objects** | Simplified physical icons: hands, organs, abstract symbols — not flat vectors |

---

## The signature look

**Light defines form, not texture.** Every object is edge-lit against total darkness. A soft white halo bleeds around silhouettes. The subject appears to emit light rather than reflect it — like a hologram suspended in a black void.

**Extreme negative space.** One focal object per frame. Generous margins. Nothing competes for attention.

---

## Typography

- Modern sans-serif, medium to bold weight
- Mostly uppercase
- White (`#F5F5F5`)
- Minimal placement with generous spacing

---

## Negative constraints

These are FORBIDDEN:

- Photorealistic skin or anatomical detail
- Busy backgrounds — the void is empty
- Any color beyond the monochrome palette
- Hard shadows or high texture detail
- Comic style, cartoon expressions, outlines
- Flat vector graphics — this is 3D rendered

---

## Rendering target

- Engine: Octane / Redshift / Cinema4D editorial render quality
- Ultra clean, very high anti-aliasing
- 4K minimum output resolution

---

## Relationship to other styles

| Style | File | Background | Use |
|-------|------|------------|-----|
| **Minimal Editorial** | `STYLE_LOCK.md` | White `#FFFFFF` | Main graphs, PPV/ROC curves, concept illustrations |
| **Flat Pictogram Purple** | `PICTOGRAM_STYLE_LOCK.md` | White `#FFFFFF` | Sn/Sp grids, 2×2 tables, icon-grid cards |
| **3D Icon Style** | `3D_STYLE_LOCK.md` | White | 3D character icons for statistics concepts |
| **Ethereal Minimal Glow** | This file | Black `#050505` | Hero art, mechanism illustrations, chapter openers, metaphors |

---

## Note on graph previews

The `/rgraph` preview system uses white backgrounds (`#ffffff` / `#f8f9fa`). This black-background style is for **concept art and hero visuals**, not data-graph previews. Do not render `/rgraph` previews with `#050505` backgrounds.
