# Session Quick-Ref — 2026-07-14 (B6 Fork, Desmoplasia, Atrophy)

Quick-lookup of the pathway forks, clinical anchors, and image prompts locked today. For deeper biochem/pharm detail, see `dev/references/FirstAid-Step1-2025-35th.pdf`.

---

## 1. B6 / INH / Methotrexate Fork

### Isoniazid → B6 Depletion

```
Isoniazid chelates PLP (pyridoxal phosphate)
    ├── HEME: ALA synthase (needs B6) → blocked → SIDEROBLASTIC ANEMIA (ringed sideroblasts)
    ├── NEUROTRANSMITTER: GABA←Glu, Serotonin←Trp → ↓ → PERIPHERAL NEUROPATHY (stocking-glove)
    └── AMINO ACID METABOLISM: transaminations → disrupted
```

**Bedside:** Give pyridoxine with INH. Don't confuse with INH-induced hepatitis (toxic metabolites, not B6).

### Methotrexate → Folate Blockade

```
Methotrexate inhibits DHFR (dihydrofolate reductase)
    ├── ↓ THYMIDINE → MEGALOBLASTIC ANEMIA (macrocytic, hyperseg neutrophils)
    └── ↓ PURINES → MUCOSITIS (GI, oral ulcers)
```

**Killer contrast:**

| Clue | Points to |
|------|-----------|
| Peripheral neuropathy + INH | B6 deficiency |
| Ringed sideroblasts on smear | Sideroblastic anemia (B6 / lead / alcohol) |
| Megaloblastic anemia + chemo | Methotrexate |

---

## 2. Peau d'Orange / Desmoplasia (Breast Cancer Clinical Sign)

**Concept:** Tumor → desmoplastic reaction → dense collagen bundles radiate from tumor → anchor to dermis → pull skin DOWN → orange-peel dimpling.

**What the image should show:** Macro cutaway of skin with surface dimpling (peau d'orange) + cross-section beneath showing taut rope-like collagen bundles pulling the dermis. No puppeteer figure. Grounded in real desmoplastic histology (dense disorganized collagen, not smooth/web/mesh).

**Saved:** `peau-dorange-desmoplastic-cutaway.png` (Cursor-Vision-Inbox)

---

## 3. Vaginal Transudate — Estrogen-Replete vs Atrophic

**Concept:** Sexual arousal → autonomic vasomotor response → pelvic capillary dilation (vasocongestion) → ↑ hydrostatic pressure → plasma filtrate pushed through epithelium = TRANSUDATE ("sweating" lubricant).

**In low estrogen:** Both pathways fail together but are SEPARATE:
- Glycogen → Lactobacillus → lactic acid → pH 3.8–4.5 (DEFENSE) — FAILS
- Vasocongestion → transudate → lubrication (COMFORT) — FAILS

**Bedside:** Vaginal pH + wet mount looking for parabasal cells. If estrogen-replete but dry → Sjogren's workup (glandular, not vascular).

**Saved:** `vaginal-transudate-A.png`, `-B.png` (Cursor-Vision-Inbox)

---

## 4. Pulmonary Embolism Saddle Embolus Grid (2x2)

**Concept:** PE saddle embolus as the locked concept — not "clot in vessel" but "solid cast at bifurcation blocking flow vs patient's external distress."

**Top row:** Internal anatomy — clot at pulmonary artery bifurcation (macro + micro)
**Bottom row:** Patient distress — copper-twa-nose-stud character, air hunger + JVD

**Saved:** `pe-saddle-embolus-grid-2x2.png`, `-v2.png`, `-v3.png`, `-v5-nano-banana-pro.png` (Cursor-Vision-Inbox)

---

## 5. Anticoagulation Metaphor (Vessel-Room Diorama)

**Concept:** Anticoagulation = locking the door after the thief is inside. Heparin/warfarin stop FUTURE clots. The existing thrombus = physical cast behind the door — needs a different process.

**Prompt locked.** Show woman in Y-shaped vessel-room, dissolving floor (circulating factors), door shut against massive clot, doctor handing heparin (blue) + warfarin (green). Clot stays stuck.

**Saved:** `anticoagulation-metaphor-A.png`, `-B.png` (Cursor-Vision-Inbox)

---

## 6. Magnific MCP — Confirmed Working

| Detail | Value |
|--------|-------|
| Server | `user-magnific` |
| Model | `imagen-nano-banana-2` (Nano Banana Pro — SOTA) |
| Mode param | `mode`, NOT `model` |
| Aspect | `16:9` for plates, `1:1` for grids |
| Resolution | `2K` |
| Credits remaining | ~147K of 240K |
| Confirmed | 2026-07-14 |

---

## 7. Character Roster Used Today

| Character | Slug | Path |
|-----------|------|------|
| Doctor KOS | `doctor-kos` | `game/dev/doctor-kos/doctor-kos-character-map.png` |
| Copper TWA | `copper-twa-nose-stud` | `game/public/assets/patient/uber/copper-twa-nose-stud-CHARACTER-MAP.png` |
| Cornrows Lady | `pinterest-cornrows-car` | `game/public/assets/patient/ladies/pinterest-cornrows-car-CHARACTER-MAP.png` |

---

## 8. Key File Locations

| What | Where |
|------|-------|
| Image generation rules (canonical) | `game/.cursor/RULES_IMAGE_GENERATION.md` (§12 = process shots) |
| Magnific MCP rules | `game/.cursor/rules/meworld-magnific-mcp.mdc` |
| **Reference PDFs index** | `game/dev/references/REFERENCE_INDEX.md` (fast-lookup for First Aid + Netter) |
| First Aid 2025 PDF | `game/dev/references/FirstAid-Step1-2025-35th.pdf` |
| Netter Anatomy Atlas 7e | `game/dev/references/Netter-Atlas-Human-Anatomy-7e.pdf` |
| Generation inbox | `C:\Users\steve\Pictures\Cursor-Vision-Inbox\` |
| Session quick-ref | `game/.cursor/memory/session-2026-07-14-quick-ref.md` |
