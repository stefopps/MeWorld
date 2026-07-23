# Case: Ischemic Colitis (Acute Colonic Ischemia)

**Date:** 2026-07-23
**CCS Case:** #87/89 — Abdominal Pain, Internal Medicine (Emergency Department)
**Score:** 24.43% (avg first attempt: 71.1%)

---

## Patient Summary

65M, financial advisor, married. Ex-smoker (quit 10yr ago), on simvastatin for hyperlipidemia. Presents to ED with left-sided crampy pain, profuse watery diarrhea, and dark red/maroon stools. Preceded by a "bad stomach bug" that left him volume depleted. Weak, light-headed.

---

## Vitals & Exam

| | Value |
|---|---|
| Temp | 37.0C |
| HR | 112 bpm (tachycardic) |
| **BP** | **88/58 (hypotensive)** |
| RR | 22 |
| BMI | 28.5 |
| HEENT | Dry mucous membranes |
| Abdomen | Mildly distended, hypoactive bowel sounds, diffusely tender. NO rebound/rigidity. |
| **Rectal** | **Maroon-colored stool, gross + occult blood positive** |

---

## Labs

| Test | Value | Signal |
|---|---|---|
| **BUN** | **52.0 mg/dL** | Prerenal azotemia |
| **Cr** | **1.70 mg/dL** | AKI (eGFR 30-59) |
| **Bicarb** | **20 mEq/L** | Metabolic acidosis |
| Na | 140 | nl |
| K | 3.5 | nl |

---

## Colonoscopy: NORMAL

No polyps, no AVM, no diverticula, no mucosal abnormalities. Cecum reached.

**This is why colonoscopy was the wrong test.** Ischemic colitis is a vascular problem — the blood supply is failing, not the mucosa. You need to look at the blood vessels and the bowel wall, not the inside lining. CT abdomen/pelvis with IV contrast is the test. Plain film can show pneumatosis (gas in the bowel wall) — pathognomonic for advanced ischemia.

---

## THE CRITICAL ERROR

| What you did | What you should have done |
|---|---|
| Colonoscopy (normal → no diagnosis) | CT abdomen/pelvis with contrast (shows pneumatosis → ischemic colitis) |
| Stayed in ED entire case | Transfer to ICU/Inpatient at 7 hours |
| No surgical consult | Call general surgery immediately (case ends when they're consulted) |
| No broad-spectrum antibiotics | Pip-tazo or carbapenem or cipro/ceftriaxone + metronidazole |

**You had 12 orders. The average for >85% scorers was 43.** You were under-ordered by 31 orders — you diagnosed yourself into a corner with a normal colonoscopy and never pivoted to the surgical abdomen pathway.

---

## Score Breakdown

| Category | Score | Weight |
|---|---|---|
| Diagnosis Orders | 33.33% | 40% |
| **Treatment Orders** | **8%** | **45%** |
| Timing | 0% | 5% |
| Appropriate Orders | 100% | 5% |
| Location/Sequence | 50% | 5% |

---

## What Was Missed (10 orders)

| Missed | Why |
|---|---|
| **CT abdomen/pelvis with contrast / CTA** | Definitive test. Shows pneumatosis, bowel wall thickening, mesenteric vessel patency. |
| **X-ray, abdomen** | Quick bedside film can show pneumatosis and portal venous gas. |
| **Lactate, serum** | Elevated lactate = tissue hypoperfusion = anaerobic metabolism. Bicarb 20 already signals this. |
| **EKG** | Pre-op clearance. Patient is heading to the OR. |
| **PT/PTT / INR** | Pre-op labs. Coagulation status before laparotomy. |
| **Type and screen** | Pre-op labs. Maroon stools + hypotension = possible transfusion. |
| **NPO** | Surgical abdomen. Nothing by mouth before OR. |
| **Surgery consult / Laparotomy** | Once CT confirms pneumatosis, call surgery immediately. The case ends here. |
| **Broad-spectrum antibiotics** | Necrotic bowel → bacterial translocation → sepsis. Anaerobe + gram-negative coverage. |
| **C. diff PCR + toxin** | Bloody diarrhea in hospital. Rule out C. diff even without recent antibiotics. |

---

## Location Error

Stayed in Emergency Department the entire case. CCS penalized at 7 hours and 12 hours: "Correct locations: ICU or Inpatient Unit." A surgical emergency does not stay in the ED.

---

## Pathophysiology — First Principles

1. **The splenic flexure is the watershed.** Between SMA (superior mesenteric artery) and IMA (inferior mesenteric artery) territories. When blood pressure drops, this is the first region to infarct. That's why the pain is LEFT-sided.

2. **Risk factors stack.** Age 65, hyperlipidemia (atherosclerosis narrows the mesenteric vessels already), plus volume depletion from the stomach bug = splanchnic vasoconstriction. Cardiac output drops → gut perfusion drops further → mucosa necroses.

3. **Pneumatosis = necrotic bowel.** Bacteria translocate through dead mucosa into the bowel wall, producing gas. This is visible on CT and plain film. Once pneumatosis appears, the bowel wall is dead. Resection required.

4. **Normal colonoscopy does NOT rule out ischemia.** The scope looks at the mucosa. Ischemia starts in the submucosa and the blood vessels. By the time the mucosa looks abnormal, the bowel may already be dead. CT is the test.

5. **Broad-spectrum antibiotics for necrotic bowel.** Dead tissue → bacterial translocation → sepsis. Cover anaerobes (metronidazole) + gram-negatives (pip-tazo, carbapenem, cipro, etc.).

6. **Surgery consult ends the case.** Ischemic colitis with pneumatosis is a surgical emergency. Once you call the surgeon, you've done your job. The surgeon decides: observe vs. resect.

---

## The Algorithm (commit to memory)

```
Elderly patient + hypotension + left-sided pain + maroon stools
│
├─ ABCs: IV fluids, NPO, type and screen, coagulation labs
├─ Imaging: CT abdomen/pelvis with IV contrast (CTA if mesenteric concern)
│   └─ Plain film: quick bedside — look for pneumatosis
├─ Labs: CBC, CMP, lactate, PT/PTT/INR
├─ Antibiotics: pip-tazo or cipro + metronidazole (broad + anaerobic)
├─ EKG (pre-op)
├─ LOCATION: ICU or Inpatient Unit (not ED)
└─ When CT shows pneumatosis → Surgery consult → Case ends
```

---

## Dossier Contents

| File | What |
|---|---|
| `case-sequence.json` | Full case flow, 10 missed orders, pathophysiology |
| `README.md` | This file |
| `01-` through `23-` PNGs | Full-resolution screenshots |
| `24-score-summary.png` | Score breakdown + CCS case summary |
| `ocr-full.txt` + `ocr-full.json` | OCR text extraction |
| `images/` | Generated descent grid (pending) |
