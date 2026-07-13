# Graph-data manifest (auto-classified, Sets 1–20)

| Set | Spine | P | M | T | File |
|-----|-------|---|---|---|------|
| 2 | Chest pain — ACS vs stable angina vs non-cardiac | 7 | 3 | 30 | `set-02-story-va.html` |
| 3 | Syncope — cardiac vs vasovagal vs orthostatic vs seizure | 13 | 7 | 20 | `set-03-story-va.html` |
| 4 | Anemia — microcytic vs macrocytic vs hemolytic vs anemia of chronic disease | 14 | 0 | 26 | `set-04-story-va.html` |
| 5 | Thyroid — hypothyroidism vs hyperthyroidism vs nodules vs cancer | 14 | 1 | 25 | `set-05-story-va.html` |
| 6 | Dyspnea — pulmonary vs cardiac vs anemia vs anxiety | 13 | 1 | 26 | `set-06-story-vb.html` |
| 7 | Acute abdomen — surgical vs medical vs gynecologic vs vascular | 12 | 2 | 26 | `set-07-story-vb.html` |
| 8 | Jaundice — pre-hepatic vs hepatic vs post-hepatic | 10 | 0 | 30 | `set-08-story-vb.html` |
| 9 | Headache — primary vs secondary vs thunderclap vs chronic | 10 | 1 | 29 | `set-09-story-vb.html` |
| 10 | Joint pain — inflammatory vs mechanical vs crystal vs infectious | 20 | 0 | 20 | `set-10-story-vb.html` |
| 11 | Diabetes — DKA vs HHS vs hypoglycemia vs complications | 7 | 18 | 15 | `set-11-story-va.html` |
| 12 | Acid-Base — metabolic acidosis vs respiratory vs mixed vs RTA | 14 | 2 | 24 | `set-12-story-va.html` |
| 13 | Electrolytes — sodium vs potassium vs calcium disorders | 15 | 13 | 12 | `set-13-story-va.html` |
| 14 | Stroke — ischemic vs hemorrhagic vs mimics | 12 | 17 | 11 | `set-14-story-va.html` |
| 15 | Renal — AKI vs stones vs obstruction vs intrinsic | 7 | 2 | 31 | `set-15-story-va.html` |
| 16 | GI Bleed — upper vs lower vs variceal vs diverticular | 14 | 7 | 19 | `set-16-story-vb.html` |
| 17 | Arrhythmias — AFib vs SVT vs VTach vs heart block | 10 | 13 | 17 | `set-17-story-vb.html` |
| 18 | Sepsis/Shock — distributive vs cardiogenic vs hypovolemic vs obstructive | 9 | 5 | 26 | `set-18-story-vb.html` |
| 19 | Endocrine — adrenal crisis vs pituitary vs Cushing vs hyperaldosteronism | 15 | 15 | 10 | `set-19-story-vb.html` |
| 20 | Infectious disease — HIV vs TB vs fungal vs IRIS | 11 | 3 | 26 | `set-20-story-vb.html` |

**Set 1** is hand-crafted (see `graph-data-set-01.json`).
**Sets 2–20** are auto-classified by matching question likely-answer text against scene diagnostic terms.
Each node has a `why` field explaining its classification.

Re-run: `node build-smart-graphs.js`
