# Spine Cluster Candidates — Full Bank Scan + Semantic Review

**Generated:** 2026-07-13T05:00Z
**Total questions:** 4,852
**Assigned to existing sets (1–20):** 800
**Unassigned available for future sets:** 4,052
**Scanner output:** `spine-cluster-data.json` (1.4 MB, full signatures)

---

## Type 1: GENUINE Patient-Repeat Clusters (verified by semantic review)

The scanner found 245 clusters by demographic match. Many are *scraper artifacts* (the same CCS question scraped 18 times under different QIDs — identical stems) or *coincidental* (same age/sex but different patients with different conditions).

Below are the clusters confirmed as **likely the same real patient** across multiple questions —
age ±5, sex, AND pathology match, with the questions showing clinical progression:

### 1. M·age 68·systolic/chronic heart failure (12 Qs, merged)
- **Clusters merged:** `systolic heart failure` (7 Qs) + `chronic heart failure` (5 Qs) — same patient across two condition-phrasings
- **Ages:** 68 · **Sex:** M
- **Assigned:** 3 Qs assigned to Sets 15, 20; 9 unassigned
- **Arc:** HF decompensations, medication adjustments, device decisions — natural progression
- **Avatar candidate:** Rober Kim (Set 17) is already 68M with CHF. This cluster **extends his existing spine**. Move unassigned Qs into his world.
- **Action:** Review for Robert Kim spine expansion. Do not create new avatar.

### 2. M·age 52·chronic kidney disease (7 Qs)
- **Ages:** 52 · **Sex:** M
- **Assigned:** Fully unassigned
- **Arc:** CKD stages, dialysis readiness, complications (anemia, hyperkalemia, bone-mineral)
- **Avatar candidate:** Could be a **new CKD avatar**, OR could be Robert Kim's CKD from HF/cardiorenal. OR could be Marcus Chen's diabetic nephropathy (but Chen is 58, not 52).
- **Travel-fit check:** Not needed — CKD is non-geographic.
- **Action:** Flag as new-avatar candidate. 52M CKD → fits as Nadia's uncle, Robert Kim's brother, or an independent renal patient.

### 3. M·age 54-55·chronic alcohol use disorder (5 Qs)
- **Ages:** 54-55 · **Sex:** M · ★ progression
- **Assigned:** Fully unassigned
- **Arc:** Alcohol withdrawal → complications (varices, pancreatitis, Wernicke)
- **Avatar candidate:** This is the **male counterpart to Elena Vasquez** (52F, alcoholic cirrhosis). One patient is male, one is female — but they could plausibly cross paths (same liver clinic, same support group, same hospital floor). Or treat as an **independent new avatar**.
- **Action:** New-avatar candidate. 54M alcoholic → could be Elena's clinic neighbor or an independent patient.

### 4. M·age 32·Graves' disease (4 Qs)
- **Ages:** 32, 32, 32, 32 · **Sex:** M
- **Assigned:** Fully unassigned
- **Arc:** Diagnosis → methimazole → thyroid storm vs radioactive iodine decision → ophthalmopathy
- **Avatar candidate:** **New endocrine avatar** — no existing patient covers hyperthyroidism. Could plausibly be Nadia's younger brother (family connection).
- **Action:** New-avatar candidate. "David" or similar. Younger male Graves'. Fits as Nadia's sibling.

### 5. M·age 44-45·Crohn's disease (4 Qs)
- **Ages:** 44-45 · **Sex:** M · ★ progression
- **Assigned:** Fully unassigned
- **Arc:** Flare management → biologics decision → complication/surgery
- **Avatar candidate:** Could be an organic encounter for **Elena Vasquez** (she's at the GI clinic for her varices, he's there for his Crohn's). Or independent new avatar.
- **Action:** Organic encounter for Elena (GI clinic waiting room). Can serve as a "door" in a future GI set.

### 6. M·age 28·opioid use disorder (4 Qs)
- **Ages:** 28 · **Sex:** M
- **Assigned:** All 4 in **Set 12** (Acid-Base scene — likely metabolic acidosis from overdose context)
- **Arc:** Use disorder → overdose → methadone/buprenorphine → complications
- **Action:** Already structured into Set 12. If Set 12 gets reworked, preserve this cluster as a mini-spine.

### 7. M·age 58-60·chronic kidney disease (4 Qs)
- **Ages:** 58-60 · **Sex:** M · ★ progression
- **Assigned:** 2 Qs in **Set 14** (Stroke), 2 unassigned
- **Action:** This overlaps with Marcus Chen (58M, t2dm with nephropathy). The unassigned Qs fit his world. Merge or keep as organic encounter.

---

### Filtered-out false clusters (scraper artifacts, not real patients)

| Scanner signature | Size | Why excluded |
|---|---|---|
| F·age 38·Hysteroscopic myomectomy | 18 | **Identical stem repeated** — same uterine fibroid question scraped 18 times. Scraper artifact, not a patient. |
| M·age 57·Colonoscopy screening | 17 | **Identical stem repeated** — annual wellness visit template. Scraper artifact. |
| F·age 72·pyelonephritis | 9 | 9/9 Qs booted into Set 8 Scene 1. Already structured. No unassigned Qs to act on. |

**Bottom line:** The scanner found 245 raw clusters. Semantic review confirms **7 genuine patient-repeat clusters** (total 38 Qs), the rest are scraper duplicates or coincidental demographic overlaps. This is exactly what the instructions predicted: true repeated-patient matches are genuinely rare. This is normal, not a failure.

---

## Type 2: Organic Encounter Proposals (LLM semantic review)

4,229 unassigned questions remain. For each major category, here is the organic-connection framework —
which existing avatar could plausibly encounter this content, and in what setting.

### Cardiovascular (187 Qs)
- **Best-fit avatar:** Robert Kim (68M, CAD/AFib/CHF) + Nadia (APS/stroke history)
- **Encounter settings:**
  - Robert Kim's cardiology clinic — other patients with valvular disease, cardiomyopathies, congenital repairs
  - Nadia's APS clinic — hypercoagulable patients with PE/DVT/coronary thrombosis
  - Nadia's hospital floor — post-MI patients, heart failure decompensations

### Respiratory (91 Qs)
- **Best-fit avatar:** Nadia (SLE → pleuritis, pulmonary fibrosis, ILD from systemic sclerosis thread)
- **Encounter settings:**
  - Nadia at pulmonary rehab — COPD, asthma, interstitial lung disease patients
  - Marcus Chen at the sleep lab — sleep apnea (common in diabetes)

### Renal (129 Qs)
- **Best-fit avatar:** Nadia (lupus nephritis) most tightly. Marcus Chen (diabetic nephropathy) second.
- **Encounter settings:**
  - Dialysis center — Nadia encounters other ESRD patients (polycystic kidneys, IgA nephropathy, Alport)
  - Renal clinic waiting room — transplant follow-ups, stone formers, UTIs

### Gastrointestinal (113 Qs)
- **Best-fit avatar:** Elena Vasquez (cirrhosis/varices)
- **Encounter settings:**
  - GI clinic — IBD patients (Crohn's/UC), liver patients (NAFLD, viral hepatitis), pancreatic patients
  - Endoscopy suite — upper/lower scope findings, polyp surveillance

### Hematology (113 Qs)
- **Best-fit avatar:** Nadia (autoimmune hemolytic anemia from SLE, APS/anticoagulation, chronic disease anemia)
- **Encounter settings:**
  - Infusion center — sickle cell patients getting transfusions, iron infusions
  - Hematology clinic — anemia workups, coagulopathies, leukemia/lymphoma follow-ups

### Infectious Disease (102 Qs)
- **Best-fit avatar:** Nadia (immunosuppressed → opportunistic infections). Travel expansion.
- **Encounter settings:**
  - **Travel to Ghana** — Nadia visiting family: malaria, typhoid, helminths, TB exposure
  - **Travel to India** — Elena going for a medical second opinion: dengue, leptospirosis, tropical infections
  - Hospital ID consult service — other immunosuppressed patients (HIV, transplant, chemo)

### Oncology (83 Qs)
- **Best-fit avatar:** Nadia (immunosuppression → skin cancers, lymphoma risk from chronic inflammation)
- **Encounter settings:**
  - Cancer center — Nadia's coworker or family member gets diagnosed
  - Screening clinic — mammograms, colonoscopies, PSA discussions

### Psychiatry (126 Qs)
- **Best-fit avatar:** The 52M panic disorder cluster and 54M alcohol cluster (from Type 1 above) are the strongest
- **Encounter settings:**
  - Nadia's chronic illness support group — depression, anxiety from chronic disease
  - Hospital psych consult — delirium, substance withdrawal, suicide risk assessments

### Neurology (114 Qs)
- **Best-fit avatar:** Nadia (neuropsychiatric SLE, seizures from Set 1, APS → stroke)
- **Encounter settings:**
  - Neurology clinic — MS, Parkinson's, Alzheimer's, myasthenia gravis patients
  - Stroke unit — other stroke etiologies (carotid, cardioembolic, lacunar)

### Endocrine (197 Qs)
- **Best-fit avatar:** Marcus Chen (T2DM) most tightly. Nadia (steroid-induced complications) second.
- **Encounter settings:**
  - Endocrine clinic — thyroid nodules, pituitary adenomas, calcium disorders
  - Diabetes education center — T1DM, gestational diabetes, insulin pump patients

### Obstetrics/Gynecology (159 Qs)
- **Best-fit avatar:** Nadia (SLE → pregnancy complications, recurrent loss from APS)
- **Encounter settings:**
  - OB/GYN clinic — Nadia's pregnancy journey (APS → high-risk OB, preeclampsia differentials)
  - Fertility clinic — other patients with recurrent pregnancy loss, fibroids, PCOS

### Emergency/Trauma (55 Qs)
- **Best-fit avatar:** All four avatars can plausibly visit an ED
- **Encounter settings:**
  - Marcus Chen: DKA admissions, hypoglycemic episodes, foot infections
  - Robert Kim: AFib with RVR, syncopal episodes, falls on anticoagulation
  - Elena Vasquez: variceal bleeds, ascites decompensation, HE
  - Nadia: lupus flares, infections, APS clot

### Dermatology (36 Qs)
- **Best-fit avatar:** Nadia (malar rash, photosensitivity, discoid lupus)
- **Encounter settings:**
  - Derm clinic — psoriasis, eczema, skin cancer screenings
  - Nadia's sun-protection awareness — other photosensitivity conditions

### Rheumatology (61 Qs)
- **Best-fit avatar:** Nadia (SLE — the most natural fit in the entire bank)
- **Encounter settings:**
  - Infusion center — other biologic patients (RA, psoriatic arthritis, ankylosing spondylitis)
  - Lupus support group — overlap syndromes, fibromyalgia, osteoarthritis

### Orthopedics (64 Qs)
- **Best-fit avatar:** Nadia (avascular necrosis from steroids, inflammatory arthritis)
- **Encounter settings:**
  - Ortho clinic — fractures, joint replacements, sports injuries
  - Nadia's nephew's sports tournament — ACL tears, concussions, shoulder dislocations

---

## Avatar Expansion Map (summary)

| Avatar | Demographics | Core territory | Organic encounters |
|---|---|---|---|
| **Nadia** | SLE, 30s F | Rheumatology, renal, neuro, infectious, heme, OB, derm | Travel (Ghana: tropical ID), workplace (hospital), support group, infusion center, family (brother with Graves, uncle with CKD) |
| **Marcus Chen** | T2DM 20yr, 58M | Endocrine, renal, foot/infection, eye | Sleep lab, diabetes education center, dialysis center, DKA admissions |
| **Elena Vasquez** | Alcoholic cirrhosis, 52F | GI bleed, varices, liver failure, HE | GI clinic (IBD neighbor), endoscopy suite, liver clinic, travel (India: tropical infections) |
| **Robert Kim** | CAD/AFib/CHF, 68M | Cardiology, arrhythmias, anticoagulation, syncope | Cardiology clinic, HF clinic, device clinic (pacemaker/ICD), ED (falls, bleeds) |
| **New candidate: CKD patient** | 52M, CKD | Renal progression, dialysis, complications | (See Type 1 cluster #2) |
| **New candidate: Graves' patient** | 32M, hyperthyroid | Thyroid storm, RAI, ophthalmopathy | (See Type 1 cluster #4 — Nadia's brother) |
| **New candidate: Alcohol patient** | 54M, AUD | Withdrawal, cirrhosis, varices | (See Type 1 cluster #3 — Elena's clinic neighbor) |

---

## Recommendations for next 10-set batch

1. **Build Sets 21-30 from these organic groupings**, not from arbitrary diagnostic overlap.
   Use the Type 2 category clusters above as scaffold — e.g., a "Nadia at the Infusion Center" set
   (rheumatology + heme encounters), an "Elena at the GI Clinic" set (IBD + liver neighbors).

2. **Integrate the 7 genuine Type 1 repeat clusters** into existing avatar spines before generating new sets.
   Robert Kim's 12 HF Qs, the 52M CKD cluster, and the 32M Graves' cluster are immediate priorities.

3. **Travel arcs** for Nadia (Ghana) and Elena (India) open ~200 otherwise-inaccessible questions
   (tropical infections, region-specific conditions) without inventing new patients.

4. **Don't build sets for the scraper duplicates.** The 38-year-old hysteroscopic myomectomy and 57-year-old
   colonoscopy clusters are identical-stem repeats — exclude from future set generation.

---

*This report + `spine-cluster-data.json` together form the complete candidate set for Master/Claude review.
None of these proposals are committed to sets, avatars, or settings yet — pure surface-for-review.*
