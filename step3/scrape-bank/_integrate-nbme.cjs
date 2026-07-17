// Integrates NBME Step 2 CK questions into existing concept graph clusters
// Maps each question by diagnosis → existing set, creates text-bank entries, adds nodes

const fs = require("fs");
const path = require("path");

const BANK_DIR = path.join(__dirname);

// ── Load parsed NBME data ──
const nbmeData = JSON.parse(fs.readFileSync(path.join(BANK_DIR, "_nbme-parsed.json"), "utf8"));

// ── Load existing text-bank to get IDs range ──
let maxId = 0;
const textBankPath = path.join(BANK_DIR, "text-bank.jsonl");
const existingIds = new Set();
try {
  const lines = fs.readFileSync(textBankPath, "utf8").split("\n").filter(l => l.trim());
  lines.forEach(line => {
    try {
      const entry = JSON.parse(line);
      if (entry.id && !isNaN(Number(entry.id))) {
        const id = Number(entry.id);
        if (id > maxId) maxId = id;
        existingIds.add(String(id));
      }
    } catch (_) {}
  });
} catch (e) {
  console.log("Could not read text-bank.jsonl:", e.message);
  maxId = 9999;
}
console.log(`Existing max ID: ${maxId}, total entries: ${existingIds.size}`);

// ── Diagnosis → Set mapping (hand-curated) ──
const diagToSet = {
  // Set 1: SLE / Lupus
  "SLE": 1, "Systemic lupus erythematosus": 1, "Lupus nephritis": 1,
  // Set 2: Chest pain / ACS
  "Stable angina": 2, "Acute coronary syndrome": 2, "Myocardial contusion": 2, "Inferior STEMI": 2, "Acute myocardial infarction": 2,
  // Set 4: Anemia
  "Iron deficiency anemia": 4, "Hemolytic anemia": 4, "Hemorrhagic shock": 4, "Aplastic anemia / Leukemia": 4, "Myelodysplastic syndrome / Aplastic anemia": 4,
  // Set 5: Thyroid
  "Hashimoto thyroiditis": 5, "Graves disease": 5, "Factitious thyrotoxicosis": 5, "Exogenous thyrotoxicosis": 5, "Thyroid nodule workup": 5,
  // Set 6: Dyspnea
  "Pulmonary hypertension": 6, "COPD": 6, "Pulmonary embolism": 6, "Spontaneous pneumothorax": 6,
  "Fat embolism": 6, "Pulmonary contusion": 6,
  // Set 7: Acute abdomen
  "Cholelithiasis": 7, "Choledocholithiasis": 7, "Small bowel obstruction": 7, "Small bowel obstruction from Crohn stricture": 7,
  "Acute pancreatitis in pregnancy": 7, "Irritable bowel syndrome": 7,
  // Set 8: Jaundice
  "Primary sclerosing cholangitis": 8, "Gilbert syndrome / Drug-induced jaundice": 8, "Alcoholic hepatitis": 8, "Hepatic encephalopathy": 8,
  // Set 9: Headache
  "Medication overuse headache": 9, "Idiopathic intracranial hypertension": 9,
  // Set 10: Joint pain
  "Ankylosing spondylitis": 10, "Costochondritis": 10, "Osteoarthritis": 10, "De Quervain tenosynovitis": 10,
  // Set 11: Diabetes
  "Diabetic ketoacidosis": 11, "Type 1 diabetes mellitus": 11, "Diabetic foot ulcer": 11,
  // Set 12: Acid-Base
  "Licorice-induced hypokalemia / metabolic alkalosis": 12, "Salicylate toxicity": 12,
  // Set 13: Electrolytes
  "Hyperkalemia": 13, "Hypocalcemia": 13, "Hypercalcemia": 13, "Hyponatremia": 13,
  // Set 14: Stroke
  "TIA / carotid stenosis": 14, "Amaurosis fugax / Carotid stenosis": 14,
  // Set 15: Renal
  "Post-streptococcal glomerulonephritis": 15, "Acute tubular necrosis": 15, "Contrast-induced nephropathy": 15,
  "Nephrolithiasis": 15, "Diabetic nephropathy": 15, "ACE inhibitor-induced AKI": 15,
  "Renal artery stenosis": 15, "Chronic pyelonephritis / Reflux nephropathy": 15,
  // Set 16: GI Bleed
  "Warfarin-induced intramural hematoma": 16, "Rectus sheath hematoma": 16,
  // Set 17: Arrhythmias
  "Cardiac tamponade": 17,
  // Set 18: Sepsis/Shock
  "Heat stroke": 18, "Sepsis": 18,
  // Set 19: Endocrine
  "Adrenal insufficiency": 19, "Primary hyperaldosteronism": 19, "SIADH": 19, "Diabetes insipidus": 19,
  "Nephrogenic diabetes insipidus": 19, "Pheochromocytoma": 19, "Insulinoma": 19,
  "Milk-alkali syndrome": 19, "Hypercalciuria / Primary hyperparathyroidism": 19,
  "Humoral hypercalcemia of malignancy": 19, "Cushing syndrome": 19,
  // Set 20: Infectious disease
  "Lyme disease": 20, "Latent TB": 20, "Latent TB treatment": 20, "Active tuberculosis": 20,
  "HIV acute infection": 20, "Secondary syphilis": 20, "EBV": 20, "Infectious mononucleosis": 20,
  "Gonococcal urethritis": 20, "Rocky Mountain spotted fever": 20, "C. difficile colitis": 20,
  "Opportunistic infection in HIV": 20, "PCP pneumonia": 20, "Genital herpes": 20,
  "ETEC gastroenteritis": 20, "Foodborne illness outbreak": 20, "Neonatal sepsis": 20,
  "Infective endocarditis": 20, "Kaposi sarcoma": 20, "Malignant otitis externa": 20,
  "Bacterial meningitis": 20, "Streptococcal pharyngitis": 20, "CAUTI": 20,
  // Set 21: Stress
  "Acute stress disorder": 21, "Adjustment disorder": 21,
  // Psychiatry-relevant sets
  "Borderline personality disorder": 52, "Brief psychotic disorder": 37,
  "Major depressive disorder": 85, "Postpartum depression": 43,
  "Schizophrenia": 12, "Acute dystonia": 12,
  "Substance-induced psychosis": 2, "Benzodiazepine dependence": 2,
  "Acute dystonia from antipsychotic": 12,
  // Cardiology
  "Dilated cardiomyopathy": 18, "Hypertrophic cardiomyopathy": 17, "Patent ductus arteriosus": 39,
  "Tricuspid regurgitation": 44, "Aortic dissection": 27,
  "Ruptured AAA": 27, "Axillary-subclavian venous thrombosis": 24,
  "Mitral valve prolapse": 21, "Tetralogy of Fallot": 40,
  "Mitral valve incompetence": 40, "Cardioembolic source / PFO": 17,
  "Pericardial effusion": 40,
  // Neurology
  "Wernicke encephalopathy": 14, "Optic neuritis": 14, "Guillain-Barre syndrome": 14, "Multiple sclerosis": 14,
  "Carpal tunnel syndrome": 14, "Ulnar neuropathy": 14, "Hydrocephalus": 14, "Normal pressure hydrocephalus": 14,
  "BPPV": 14, "Creutzfeldt-Jakob disease": 14, "Lambert-Eaton myasthenic syndrome": 14,
  "Meralgia paresthetica": 14, "Dermatomyositis": 14, "Spinal cord compression": 14,
  "Spinal cord injury / Syringomyelia": 14, "First seizure": 14, "Huntington disease": 14,
  "Alzheimer disease": 14,
  // ObGyn
  "PCOS": 26, "DVT in pregnancy": 26, "Postpartum hemorrhage": 26, "Postpartum hemorrhage from laceration": 26,
  "Preterm labor": 26, "Normal labor": 26, "Preeclampsia / HELLP syndrome": 26, "Placenta accreta": 26,
  "Blighted ovum": 26, "Threatened abortion / Ectopic pregnancy": 26, "Pelvic inflammatory disease / Cervicitis": 26,
  "Pelvic organ prolapse": 26, "GBS prophylaxis": 26, "Bartholin cyst": 26,
  "Decreased fetal movement": 26, "Preterm birth risk": 26,
  // Pediatrics
  "Nursemaid elbow": 35, "Croup": 35, "Impetigo": 35, "Tourette syndrome": 35,
  "Pyloric stenosis": 35, "Vascular ring": 35, "Intussusception / Malrotation": 35,
  "Kawasaki disease": 35, "Slipped capital femoral epiphysis": 35,
  "Avascular necrosis of femoral head": 35, "Congenital torticollis": 35,
  "Constitutional delay of puberty": 35,
  // Immunology / Genetics
  "Sjogren syndrome": 1, "Chronic granulomatous disease": 38, "Selective IgA deficiency": 38,
  "Wiskott-Aldrich syndrome": 38, "SCID / T-cell deficiency": 38, "Hereditary angioedema": 38,
  "Pompe disease": 38, "Cystic fibrosis": 38, "Turner syndrome": 38,
  "Hemophilia A": 38, "Immune thrombocytopenia / ITP": 38,
  // Other diagnostics
  "Anaphylaxis": 22, "Testicular torsion": 22, "Testicular cancer": 22,
  "Prostate cancer metastasis": 22, "Gastric cancer": 22, "Melanoma": 22,
  "Breast implant-associated ALCL": 22, "Paget disease of breast": 22,
  // Vascular
  "Venous stasis ulcer": 28, "Peripheral arterial disease": 28, "TIA / carotid stenosis": 14,
  // Urology
  "Varicocele": 22, "Stress urinary incontinence": 22, "BPH": 22, "BPH with urinary retention": 22,
  "Urethral injury": 22,
  // Others
  "Hyperlipidemia screening": 2, "Cardiovascular risk assessment": 2, "Atherosclerosis": 2,
  "Depression screening": 85, "Insomnia": 85, "Psychogenic polydipsia": 85,
  "Capacity assessment": 85, "Delirium": 14, "Mild traumatic brain injury": 14,
  "Lactose intolerance": 7, "GERD": 7, "Esophageal perforation / Boerhaave": 7,
  // Biostats
  "Study design - RCT": 12, "Measures of association": 12, "Screening test characteristics": 12,
  "Predictive values": 12, "Sample size / Power": 12, "Confidence interval interpretation": 12,
  "Statistical power": 12, "External validity": 12, "Confounding in observational studies": 12,
  "Research ethics - vulnerable populations": 12,
};

// ── Find best cluster for a question by diagnosis ──
function findCluster(diagnosis, topic) {
  // Direct match
  if (diagToSet[diagnosis]) return diagToSet[diagnosis];

  // Fuzzy match by topic
  const topicMap = {
    "Cardiology": 2, "Cardiology/Pulmonology": 6, "Cardiology/Emergency": 2, "Cardiology/Pediatrics": 39,
    "Cardiology/Surgery": 17, "Cardiology/Infectious Disease": 20,
    "Pulmonology": 6, "Pulmonology/Emergency": 6, "Pulmonology/Critical Care": 6, "Pulmonology/Genetics": 38,
    "Pulmonology/Occupational": 6, "Pulmonology/Preventive": 6,
    "Nephrology": 15, "Nephrology/Emergency": 13, "Nephrology/Cardiology": 15,
    "Nephrology/Endocrinology": 19, "Nephrology/Urology": 15, "Nephrology/Pediatrics": 15,
    "Gastroenterology": 7, "Gastroenterology/ObGyn": 7, "Gastroenterology/Surgery": 7,
    "Gastroenterology/Genetics": 38, "Gastroenterology/Preventive": 7,
    "Neurology": 14, "Neurology/Ophthalmology": 9, "Neurology/Pediatrics": 14, "Neurology/Vascular": 14,
    "Neurology/ENT": 14, "Neurology/Geriatrics": 14, "Neurology/Oncology": 14,
    "Psychiatry": 85, "Psychiatry/Addiction": 85, "Psychiatry/ObGyn": 43, "Psychiatry/Neurology": 14,
    "Psychiatry/Pediatrics": 35, "Psychiatry/Preventive": 85,
    "Rheumatology": 10, "Rheumatology/Nephrology": 15, "Rheumatology/Orthopedics": 10,
    "Endocrinology": 19, "Endocrinology/Emergency": 11, "Endocrinology/Oncology": 19,
    "Endocrinology/Nephrology": 15, "Endocrinology/Neurology": 19,
    "ObGyn": 26, "ObGyn/Endocrinology": 11, "ObGyn/Preventive": 26, "ObGyn/Infectious Disease": 20,
    "ObGyn/Hematology": 4,
    "Hematology": 4, "Hematology/Pediatrics": 38, "Hematology/Oncology": 22,
    "Hematology/Immunology": 38, "Hematology/Nutrition": 4,
    "Pediatrics": 35, "Pediatrics/Surgery": 35, "Pediatrics/Cardiology": 39,
    "Pediatrics/Infectious Disease": 20, "Pediatrics/Endocrinology": 19,
    "Pediatrics/Dermatology": 74, "Pediatrics/Genetics": 38, "Pediatrics/Preventive": 35,
    "Infectious Disease": 20, "Infectious Disease/Neurology": 20,
    "Infectious Disease/Gastroenterology": 7, "Infectious Disease/ENT": 20,
    "Infectious Disease/ObGyn": 20, "Infectious Disease/Oncology": 20,
    "Infectious Disease/Urology": 20, "Infectious Disease/Preventive": 20,
    "Infectious Disease/Nephrology": 15,
    "Oncology": 22, "Oncology/Neurology": 14, "Oncology/Dermatology": 74,
    "Oncology/Gastroenterology": 7, "Oncology/Surgery": 22, "Oncology/Cardiology": 17,
    "Oncology/Palliative Care": 22, "Oncology/Endocrinology": 19,
    "Oncology/Infectious Disease": 20,
    "Emergency Medicine": 18, "Emergency/Trauma": 18, "Emergency/Vascular": 27,
    "Emergency/Pediatrics": 35, "Emergency/Pulmonology": 6, "Emergency/Surgery": 7,
    "Emergency/Hematology": 4, "Emergency/Immunology": 38,
    "Orthopedics": 10, "Orthopedics/Pediatrics": 35, "Orthopedics/Neurology": 14,
    "Orthopedics/Hematology": 4, "Orthopedics/Emergency": 18,
    "Urology": 22, "Urology/Emergency": 22, "Urology/Trauma": 22, "Urology/ObGyn": 22,
    "Dermatology": 74, "Dermatology/Pediatrics": 74, "Dermatology/Oncology": 74,
    "Dermatology/Vascular": 28, "Dermatology/Infectious Disease": 20,
    "Dermatology/ObGyn": 26,
    "Preventive Medicine": 2, "Preventive Medicine/Cardiology": 2,
    "Preventive Medicine/Gastroenterology": 7, "Preventive Medicine/Infectious Disease": 20,
    "Ophthalmology": 9, "ENT": 9, "ENT/Pediatrics": 35, "ENT/Pulmonology": 6,
    "Immunology": 38, "Immunology/Pediatrics": 38,
    "Genetics": 38, "Genetics/Pediatrics": 38, "Genetics/ObGyn": 26,
    "Biostatistics": 12, "Biostatistics/Preventive": 12,
    "Toxicology": 12, "Toxicology/Emergency": 12, "Toxicology/Neurology": 14,
    "Ethics": 85, "Ethics/Pediatrics": 35, "Ethics/Palliative Care": 85,
    "Ethics/Biostatistics": 12, "Ethics/Genetics": 38, "Ethics/Neurology": 14,
    "Nutrition": 13, "Nutrition/Global Health": 13,
    "Public Health": 12, "Public Health/Infectious Disease": 20,
    "Surgery": 22, "Surgery/Infectious Disease": 20,
    "Geriatrics": 14, "Vascular": 28, "Vascular/Cardiology": 28,
    "Vascular/Trauma": 27, "Vascular/Ethics": 27,
  };

  if (topicMap[topic]) return topicMap[topic];

  // Fallback: match by keywords in diagnosis
  const keywordMap = {
    "sle": 1, "lupus": 1, "sjogren": 1,
    "acs": 2, "angina": 2, "chest pain": 2, "mi": 2,
    "syncope": 3,
    "anemia": 4, "anemic": 4, "hematolog": 4,
    "thyroid": 5, "hyperthyroid": 5, "hypothyroid": 5, "graves": 5, "hashimoto": 5,
    "dyspnea": 6, "copd": 6, "pulmonary": 6, "pneumothorax": 6,
    "abdomen": 7, "cholecyst": 7, "appendic": 7, "bowel": 7, "gerd": 7,
    "jaundice": 8, "cirrhos": 8, "hepatitis": 8,
    "headache": 9, "migraine": 9,
    "arthritis": 10, "joint": 10, "osteoarth": 10, "ankylos": 10, "gout": 10,
    "diabet": 11, "dka": 11, "hhs": 11, "hypoglyc": 11,
    "acid": 12, "alkal": 12, "base": 12,
    "electrolyt": 13, "sodium": 13, "potassium": 13, "calcium": 13, "magnesium": 13,
    "stroke": 14, "tia": 14, "neuro": 14, "seizure": 14, "encephal": 14,
    "renal": 15, "kidney": 15, "aki": 15, "neph": 15,
    "gi bleed": 16, "hematemesis": 16, "melena": 16,
    "arrhythm": 17, "afib": 17, "svt": 17, "heart block": 17, "tachy": 17,
    "sepsis": 18, "shock": 18,
    "endocrine": 19, "adrenal": 19, "pituitary": 19, "cushing": 19, "pheo": 19,
    "infection": 20, "hiv": 20, "tb": 20, "meningitis": 20, "pneumonia": 20,
    "psych": 85, "depress": 85, "anxiety": 85, "personality disorder": 52,
    "obgyn": 26, "pregnan": 26, "labor": 26, "postpartum": 26, "preterm": 26,
    "pediatric": 35, "child": 35, "infant": 35,
    "dermat": 74, "rash": 74, "skin": 74,
    "cancer": 22, "tumor": 22, "malign": 22, "leukem": 22, "lymphoma": 22,
    "biostat": 12, "rct": 12, "power": 12, "sensitivity": 12, "specificity": 12, "ppv": 12,
  };

  const diag = diagnosis.toLowerCase();
  for (const [kw, setId] of Object.entries(keywordMap)) {
    if (diag.includes(kw)) return setId;
  }

  return 0; // no match found
}

// ── Process all questions ──
const textBankEntries = [];
const clusterAssignments = {}; // { setId: [nodeIds] }
let nextId = maxId + 1;
let unmatched = 0;

for (const q of nbmeData) {
  const setId = findCluster(q.diagnosis, q.topic);
  if (setId === 0) {
    console.log(`UNMATCHED: ${q.id} - "${q.diagnosis}" (topic: ${q.topic})`);
    unmatched++;
    continue;
  }

  const newId = String(nextId++);

  // Create text-bank entry
  const entry = {
    id: newId,
    question: q.stem,
    answers: [
      { label: "A", text: "Answer A (NBME form - see reference)" },
      { label: "B", text: "Answer B (NBME form - see reference)" },
      { label: "C", text: "Answer C (NBME form - see reference)" },
      { label: "D", text: "Answer D (NBME form - see reference)" },
      { label: "E", text: "Answer E (NBME form - see reference)" },
    ],
    explanation: `[NBME ${q.form}] Diagnosis: ${q.diagnosis}. ${q.answer}. (Full answer options not available from nbme.herokuapp.com; reference full form for complete stem and options.)`,
    likely: "A.",
  };
  textBankEntries.push(entry);

  // Track cluster assignment
  if (!clusterAssignments[setId]) clusterAssignments[setId] = [];
  clusterAssignments[setId].push({
    id: newId,
    diagnosis: q.diagnosis,
    form: q.form,
    qnum: q.qnum,
  });
}

console.log(`\nMatched: ${nbmeData.length - unmatched}, Unmatched: ${unmatched}`);
console.log(`New IDs assigned: ${maxId + 1} → ${nextId - 1}`);

// ── Write text-bank entries ──
fs.writeFileSync(
  path.join(BANK_DIR, "_nbme-text-bank.jsonl"),
  textBankEntries.map(e => JSON.stringify(e)).join("\n")
);
console.log(`\nWrote ${textBankEntries.length} entries to _nbme-text-bank.jsonl`);

// ── Write cluster assignment report ──
const reportLines = ["# NBME → Existing Cluster Assignments", ""];
const sortedSets = Object.keys(clusterAssignments).sort((a, b) => Number(a) - Number(b));

for (const setId of sortedSets) {
  reportLines.push(`## Set ${setId}`);
  for (const node of clusterAssignments[setId]) {
    reportLines.push(`- ID ${node.id}: [${node.form}] Q${node.qnum} — ${node.diagnosis}`);
  }
  reportLines.push("");
}

fs.writeFileSync(path.join(BANK_DIR, "_nbme-cluster-report.md"), reportLines.join("\n"));
console.log(`Wrote cluster report to _nbme-cluster-report.md`);

// ── Save cluster assignments JSON ──
fs.writeFileSync(path.join(BANK_DIR, "_nbme-cluster-assignments.json"), JSON.stringify(clusterAssignments, null, 2));
console.log(`Wrote cluster assignments to _nbme-cluster-assignments.json`);

// ── Summary ──
console.log(`\n=== SUMMARY ===`);
console.log(`Total NBME questions: ${nbmeData.length}`);
console.log(`Matched to clusters: ${nbmeData.length - unmatched}`);
console.log(`Unmatched: ${unmatched}`);
console.log(`New text-bank entries: ${textBankEntries.length}`);
console.log(`Clusters receiving new nodes: ${sortedSets.length}`);
for (const setId of sortedSets) {
  console.log(`  Set ${setId}: ${clusterAssignments[setId].length} nodes`);
}
