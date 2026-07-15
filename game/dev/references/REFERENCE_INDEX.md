# MeWorld Reference Index — Fast Agent Lookup

Both PDFs live in `game/dev/references/`. Use this index to jump to the right section/page without parsing entire PDFs.

---

## PDF 1: FirstAid-Step1-2025-35th.pdf (125 MB, 865 pages)

### Biochemistry

| Topic | Section | Approx Page |
|-------|---------|-------------|
| Vitamins (B1–B12, folate, biotin) | Biochemistry → Vitamins | ~64–68 |
| B6 / Pyridoxine — ALA synthase, GABA, serotonin | Biochemistry → Vitamins | ~65 |
| Heme synthesis (ALA synthase, porphyrias) | Biochemistry → Porphyrins | ~56 |
| Neurotransmitters (GABA, serotonin, dopamine, NE) | Biochemistry → Neurotransmitters | ~530 |
| Fatty acid oxidation (odd-chain, propionic acid, biotin) | Biochemistry → Lipid Metabolism | ~73 |
| Glycogen / glycolysis / TCA | Biochemistry → Metabolism | ~70–85 |
| Collagen synthesis | Biochemistry → Connective Tissue | ~44 |

### Pharmacology

| Topic | Section | Approx Page |
|-------|---------|-------------|
| Isoniazid (INH) — B6 chelation | Pharm → Antimycobacterial | ~193 |
| Methotrexate — DHFR inhibition | Pharm → Antineoplastics | ~430 |
| Heparin / Warfarin / Anticoagulants | Pharm → Hematology | ~440 |
| SSRIs / Antihistamines (anticholinergic) | Pharm → Neuro/Psych | ~590 |

### Hematology

| Topic | Section | Approx Page |
|-------|---------|-------------|
| Microcytic anemias (iron, sideroblastic, thalassemias) | Heme → Microcytic | ~416 |
| Sideroblastic anemia (ringed sideroblasts) | Heme → Microcytic | ~416 |
| Macrocytic anemias (B12, folate, megaloblastic) | Heme → Macrocytic | ~418 |
| Lead poisoning (basophilic stippling, FEP) | Heme → Microcytic | ~416 |

### Organ Systems

| Topic | Section | Approx Page |
|-------|---------|-------------|
| Pulmonary embolism / VTE | Cardio → Embolism | ~304 |
| Right heart strain (JVD, RV failure) | Cardio → Heart Failure | ~298 |
| Breast pathology (desmoplasia, peau d'orange) | Reproductive → Breast | ~668 |
| Vaginal epithelium / estrogen effects | Repro → Histology | ~662 |
| Thrombosis / Virchow's triad | Heme → Thrombosis | ~432 |

### Rapid Review Appendix (classic associations)

| Topic | Approx Page |
|-------|-------------|
| Rapid Review — Classic Findings | ~760 |
| Rapid Review — Classic Treatments | ~770 |
| Rapid Review — Classic Associations | ~780 |

---

## PDF 2: Netter-Atlas-Human-Anatomy-7e.pdf (121 MB)

### Regional Anatomy

| Region | Plate Range |
|--------|-------------|
| Head & Neck | 1–160 |
| Thorax (heart, lungs, great vessels) | 161–240 |
| Abdomen (GI, liver, biliary) | 241–340 |
| Pelvis & Perineum (reproductive, pelvic floor) | 341–400 |
| Upper Limb | 401–480 |
| Lower Limb | 481–560 |

### High-Yield for MeWorld Image Visuals

| What to render | Netter Plate |
|----------------|-------------|
| Pulmonary artery bifurcation (saddle) | Thorax → Heart/Great Vessels |
| Heart — RV, pulmonary outflow | Thorax → Heart |
| Jugular veins (internal/external) | Head & Neck → Neck Vasculature |
| Breast / chest wall cross-section | Thorax → Breast |
| Vaginal epithelium / pelvic cross-section | Pelvis → Female Reproductive |
| Brachial plexus (anesthesia) | Upper Limb → Brachial Plexus |
| Lungs — segmental anatomy | Thorax → Lungs |

### Surface & Cross-Sectional

| What to render | Netter Plate |
|----------------|-------------|
| Cross-sectional thorax (CT correlation) | Thorax → Cross-Section |
| Surface anatomy — neck JVP landmarks | Head & Neck → Surface |
| Surface anatomy — chest wall | Thorax → Surface |

---

## Quick Agent Command

When an agent needs reference lookup, read this index first, then target the PDF section:

```
For B6/INH/methotrexate pharmacology: FirstAid-Step1-2025-35th.pdf ~p.64-68 (vitamins), ~p.193 (INH), ~p.430 (MTX)
For pulmonary artery anatomy: Netter-Atlas-Human-Anatomy-7e.pdf → Thorax → Heart/Great Vessels
For breast desmoplasia anatomy: Netter → Thorax → Breast; FirstAid → ~p.668
For vaginal epithelium estrogen effects: Netter → Pelvis → Female Reproductive; FirstAid → ~p.662
```
