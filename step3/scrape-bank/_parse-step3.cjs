// Parse Step 3 Free 137 questions from The Match Guy (Blocks 1-2, 37 questions)

const fs = require("fs");
const path = require("path");

const BANK_DIR = path.join(__dirname);

// ── Block 1 questions (17 items) ──
const block1 = [
  { qnum: 1, stem: "55-year-old man with bounding pulses, widened pulse pressure, displaced PMI, and diastolic decrescendo murmur", answer: "Transthoracic echocardiography", diagnosis: "Aortic regurgitation", topic: "Cardiology" },
  { qnum: 2, stem: "16-year-old with academic decline and cannabis use. Physician must balance confidentiality with support.", answer: "Non-judgmental approach focusing on effects of cannabis use on functioning", diagnosis: "Adolescent substance use counseling", topic: "Ethics/Pediatrics" },
  { qnum: 3, stem: "Patient with severe COPD and DNR requesting removal of NIPPV. Advance directive is unclear.", answer: "Clarify goals of care and confirm alignment with advance directive", diagnosis: "Goals of care / Advance directive", topic: "Ethics/Pulmonology" },
  { qnum: 4, stem: "Study comparing emergency portacaval shunt vs endoscopic sclerotherapy for variceal bleeding. Calculate NNT to prevent one case of recurrent PSE.", answer: "NNT = 5", diagnosis: "Number needed to treat", topic: "Biostatistics" },
  { qnum: 5, stem: "What limits generalizability of EPCS vs EST study for variceal bleeding?", answer: "EPCS requires specialized expertise only at tertiary centers", diagnosis: "External validity / Generalizability", topic: "Biostatistics" },
  { qnum: 6, stem: "EPCS vs EST study: mean hospital readmissions for variceal bleeding was 0.4 vs 6.8 (P<.001)", answer: "EPCS is more effective than EST in decreasing hospital readmissions for variceal bleeding requiring transfusion", diagnosis: "Clinical trial interpretation", topic: "Biostatistics" },
  { qnum: 7, stem: "4-year-old boy on long-term glucocorticoids for asthma presents with weight loss, fatigue, hyponatremia, normal potassium", answer: "Secondary adrenal insufficiency from chronic HPA axis suppression", diagnosis: "Secondary adrenal insufficiency", topic: "Endocrinology" },
  { qnum: 8, stem: "64-year-old woman post-inguinal hernia repair with acute dyspnea, tachycardia, hypoxemia, elevated D-dimer, clear lung fields", answer: "Pulmonary embolism", diagnosis: "Pulmonary embolism", topic: "Pulmonology" },
  { qnum: 9, stem: "Two ROC curves: Test A curve lies above Test B in low false-positive range. What does this mean?", answer: "Test A is more accurate in the low false-positive rate range", diagnosis: "ROC curve interpretation", topic: "Biostatistics" },
  { qnum: 10, stem: "19-year-old college student in Western NC with fever, headache, macular rash with petechiae on palms/soles, thrombocytopenia, CSF with high opening pressure", answer: "Rocky Mountain spotted fever (Rickettsia rickettsii)", diagnosis: "Rocky Mountain spotted fever", topic: "Infectious Disease" },
  { qnum: 11, stem: "19-year-old pregnant woman who smokes. What is the greatest SIDS risk factor for her infant?", answer: "Maternal smoking during pregnancy", diagnosis: "SIDS risk factors", topic: "ObGyn/Pediatrics" },
  { qnum: 12, stem: "75-year-old man with left lower lobe pneumonia. Hypoxemia worsens when lying on left side, improves on right.", answer: "Gravity-dependent V/Q mismatch in consolidated lung", diagnosis: "V/Q mismatch in pneumonia", topic: "Pulmonology" },
  { qnum: 13, stem: "12-year-old girl with seizure disorder requests carbamazepine dose and refill. Aunt (not guardian) brings her. Mother unreachable.", answer: "Contact mother for consent; do not treat without guardian consent in non-emergency", diagnosis: "Minor consent / Informed consent", topic: "Ethics/Pediatrics" },
  { qnum: 14, stem: "Patient with knee pain, morning stiffness <30 min, bony enlargement, crepitus", answer: "Joint space narrowing, subchondral sclerosis, osteophytes on x-ray", diagnosis: "Osteoarthritis", topic: "Rheumatology" },
  { qnum: 15, stem: "54-year-old woman with recurrent upper abdominal pain, nausea, burning throat. Preoccupied with symptoms, convinced she has Barrett esophagus despite negative workup.", answer: "Explore her goals and expectations regarding treatment", diagnosis: "Health anxiety / Medically unexplained symptoms", topic: "Psychiatry" },
  { qnum: 16, stem: "Patient with generalized pruritus on oxycodone, no rash except excoriations", answer: "Opioid-induced histamine release causing pruritus", diagnosis: "Opioid-induced pruritus", topic: "Pharmacology/Toxicology" },
  { qnum: 17, stem: "Patient with mild scleral icterus and palpable epigastric mass, 15-lb weight loss", answer: "CT scan of the abdomen", diagnosis: "Pancreatic cancer", topic: "Oncology/Gastroenterology" },
  { qnum: 18, stem: "Patient with severe abdominal pain, fever, metabolic acidosis, leukocytosis. X-ray shows dilated bowel loops. Surgical resection shows coagulative necrosis.", answer: "Coagulative necrosis of mucosa and submucosa from ischemia", diagnosis: "Acute mesenteric ischemia", topic: "Gastroenterology/Emergency" },
];

// ── Block 2 questions (19 items) ──
const block2 = [
  { qnum: 19, stem: "Discrepancies in oxygen administration due to unclear protocols. Best approach?", answer: "Standardize oxygen administration orders with clear titration guidelines", diagnosis: "Quality improvement / Standardized protocols", topic: "Quality Improvement" },
  { qnum: 20, stem: "29-year-old woman with HIV, undetectable viral load on ART, considering pregnancy. Strongest determinant of perinatal transmission risk?", answer: "Maternal viral load is the strongest determinant of perinatal HIV transmission risk", diagnosis: "Perinatal HIV transmission", topic: "ObGyn/Infectious Disease" },
  { qnum: 21, stem: "24-year-old woman with cyclic irritability, insomnia, mood swings lasting 2-3 weeks before menses", answer: "Ask patient to track symptoms over 2-3 cycles to confirm PMDD", diagnosis: "Premenstrual dysphoric disorder", topic: "ObGyn/Psychiatry" },
  { qnum: 22, stem: "18-year-old woman requests stimulant (Essepro XL) for academic performance and weight loss without ADHD diagnosis", answer: "Do not prescribe — no clinical indication for stimulant; risk of misuse", diagnosis: "Stimulant misuse prevention", topic: "Ethics/Psychiatry" },
  { qnum: 23, stem: "Advertisement: Essepro XL provides better 'late afternoon performance' vs methylphenidate XL. Key benefit?", answer: "Increased duration of action", diagnosis: "Medication pharmacokinetics", topic: "Pharmacology" },
  { qnum: 24, stem: "63-year-old man with transient monocular vision loss (amaurosis fugax). Best next step?", answer: "Carotid ultrasonography", diagnosis: "Amaurosis fugax / Carotid stenosis", topic: "Neurology/Vascular" },
  { qnum: 25, stem: "63-year-old woman with CKD stage 3 develops AKI (rising Cr, hyperkalemia, oliguria) after hospitalization", answer: "Pre-existing CKD predisposed her to AKI from reduced renal reserve", diagnosis: "Acute kidney injury on CKD", topic: "Nephrology" },
  { qnum: 26, stem: "28-year-old man with dysuria and minimal urethral discharge. Sexually active.", answer: "PCR testing for N. gonorrhoeae and C. trachomatis", diagnosis: "Urethritis / STI", topic: "Infectious Disease/Urology" },
  { qnum: 27, stem: "44-year-old woman with heavy menstrual bleeding x10 days, enlarged fibroid uterus, fatigue", answer: "Endometrial biopsy to rule out hyperplasia/carcinoma", diagnosis: "Abnormal uterine bleeding / Endometrial hyperplasia", topic: "ObGyn" },
  { qnum: 28, stem: "2-month-old boy with conjugated hyperbilirubinemia, hypoplastic gallbladder on US, elevated direct bilirubin", answer: "Bile ductular proliferation on biopsy (biliary atresia)", diagnosis: "Biliary atresia", topic: "Pediatrics/Gastroenterology" },
  { qnum: 29, stem: "68-year-old man with acute ataxia, dysphagia, left-sided weakness, right facial droop. Lesion location?", answer: "Vertebrobasilar system (posterior circulation)", diagnosis: "Vertebrobasilar stroke", topic: "Neurology" },
  { qnum: 30, stem: "2-week-old newborn with trisomy 18, severe growth restriction, cardiac anomalies. Best disposition?", answer: "Hospice care for comfort and family support", diagnosis: "Trisomy 18 / Palliative care", topic: "Pediatrics/Ethics" },
  { qnum: 31, stem: "58-year-old man with inferior STEMI (II, III, aVF) becomes hypotensive after nitroglycerin. Clear lung fields.", answer: "Right ventricular infarction — nitroglycerin reduced preload. Give IV fluids.", diagnosis: "Right ventricular MI", topic: "Cardiology/Emergency" },
  { qnum: 32, stem: "RCT: intervention group had 7 fewer inflamed joints vs placebo (P=0.02). Is this clinically significant?", answer: "Yes — the magnitude of joint reduction is clinically meaningful for RA patients", diagnosis: "Clinical vs statistical significance", topic: "Biostatistics" },
  { qnum: 33, stem: "60-year-old woman with Parkinson disease, dementia, bipolar disorder. Unable to recall medications. Brother unreachable.", answer: "Contact her pharmacy to confirm medication history", diagnosis: "Medication reconciliation in cognitive impairment", topic: "Geriatrics/Pharmacology" },
  { qnum: 34, stem: "African American patients underrepresented in research study due to reluctance to enroll. Best approach?", answer: "Convene a representative focus group to identify barriers", diagnosis: "Research diversity / Community engagement", topic: "Ethics/Biostatistics" },
  { qnum: 35, stem: "52-year-old man with cirrhosis presents with fever, hemorrhagic bullae, hypotension after eating raw oysters", answer: "Vibrio vulnificus sepsis", diagnosis: "Vibrio vulnificus infection", topic: "Infectious Disease" },
  { qnum: 36, stem: "55-year-old man with fasting glucose 126 mg/dL. Best next step?", answer: "Measure hemoglobin A1c to confirm diabetes diagnosis", diagnosis: "Impaired fasting glucose / Prediabetes", topic: "Endocrinology" },
  { qnum: 37, stem: "3-month-old infant with respiratory distress, head bobbing, nasal flaring, wheezing. CXR: bilateral hyperinflation, peribronchial cuffing. Winter.", answer: "RSV bronchiolitis", diagnosis: "Bronchiolitis / RSV", topic: "Pediatrics/Infectious Disease" },
];

const allQuestions = [...block1, ...block2];

// ── Load existing text-bank to get max ID ──
let maxId = 0;
const textBankPath = path.join(BANK_DIR, "text-bank.jsonl");
try {
  const lines = fs.readFileSync(textBankPath, "utf8").split("\n").filter(l => l.trim());
  lines.forEach(line => {
    try {
      const entry = JSON.parse(line);
      if (entry.id && !isNaN(Number(entry.id))) {
        const id = Number(entry.id);
        if (id > maxId) maxId = id;
      }
    } catch (_) {}
  });
} catch (e) {
  maxId = 9999;
}
console.log(`Existing max ID: ${maxId}`);

// ── Diagnosis → existing Set mapping ──
const diagToSet = {
  "Aortic regurgitation": 2,
  "Secondary adrenal insufficiency": 19,
  "Pulmonary embolism": 6,
  "Rocky Mountain spotted fever": 20,
  "Osteoarthritis": 10,
  "Pancreatic cancer": 22,
  "Acute mesenteric ischemia": 7,
  "Premenstrual dysphoric disorder": 26,
  "Urethritis / STI": 20,
  "Abnormal uterine bleeding / Endometrial hyperplasia": 26,
  "Biliary atresia": 35,
  "Vertebrobasilar stroke": 14,
  "Right ventricular MI": 2,
  "Vibrio vulnificus infection": 20,
  "Amaurosis fugax / Carotid stenosis": 14,
  "Impaired fasting glucose / Prediabetes": 11,
  "Bronchiolitis / RSV": 35,
  "Acute kidney injury on CKD": 15,
  "V/Q mismatch in pneumonia": 6,
  "SIDS risk factors": 26,
  "Perinatal HIV transmission": 26,
  "Opioid-induced pruritus": 12,
  "NNT calculation": 12,
  "External validity": 12,
  "Clinical trial interpretation": 12,
  "ROC curve interpretation": 12,
  "Clinical vs statistical significance": 12,
};

// Topic fallbacks
const topicToSet = {
  "Cardiology": 2, "Cardiology/Emergency": 2,
  "Pulmonology": 6,
  "Endocrinology": 19,
  "Infectious Disease": 20, "Infectious Disease/Urology": 20,
  "Rheumatology": 10,
  "Oncology/Gastroenterology": 7,
  "Gastroenterology/Emergency": 7,
  "ObGyn": 26, "ObGyn/Psychiatry": 26, "ObGyn/Pediatrics": 26, "ObGyn/Infectious Disease": 26,
  "Neurology": 14, "Neurology/Vascular": 14,
  "Nephrology": 15,
  "Pediatrics": 35, "Pediatrics/Gastroenterology": 35, "Pediatrics/Ethics": 35,
  "Pediatrics/Infectious Disease": 35,
  "Ethics": 85, "Ethics/Pediatrics": 85, "Ethics/Pulmonology": 85,
  "Ethics/Psychiatry": 85, "Ethics/Biostatistics": 12,
  "Psychiatry": 85,
  "Biostatistics": 12,
  "Pharmacology": 12, "Pharmacology/Toxicology": 12,
  "Geriatrics/Pharmacology": 14,
  "Quality Improvement": 85,
};

function findSet(diagnosis, topic) {
  if (diagToSet[diagnosis]) return diagToSet[diagnosis];
  if (topicToSet[topic]) return topicToSet[topic];
  return 0;
}

// ── Build entries ──
const entries = [];
const clusterAssignments = {};
let nextId = maxId + 1;
let unmatched = 0;

for (const q of allQuestions) {
  const setId = findSet(q.diagnosis, q.topic);
  if (setId === 0) {
    console.log(`UNMATCHED: Q${q.qnum} - "${q.diagnosis}" (topic: ${q.topic})`);
    unmatched++;
    continue;
  }

  const newId = String(nextId++);
  
  entries.push(JSON.stringify({
    id: newId,
    question: q.stem,
    answers: [
      { label: "A", text: q.answer },
      { label: "B", text: "See NBME Free 137 Step 3 for options" },
      { label: "C", text: "See NBME Free 137 Step 3 for options" },
      { label: "D", text: "See NBME Free 137 Step 3 for options" },
      { label: "E", text: "See NBME Free 137 Step 3 for options" },
    ],
    explanation: `[NBME Step 3 Free 137 Q${q.qnum}] ${q.diagnosis}. ${q.answer}`,
    likely: "A.",
  }));

  if (!clusterAssignments[setId]) clusterAssignments[setId] = [];
  clusterAssignments[setId].push({ id: newId, diagnosis: q.diagnosis, source: `Step3-Free137-Q${q.qnum}` });
}

console.log(`\nMatched: ${allQuestions.length - unmatched}, Unmatched: ${unmatched}`);
console.log(`New IDs: ${maxId + 1} → ${nextId - 1}`);

// ── Write text-bank entries ──
fs.writeFileSync(path.join(BANK_DIR, "_step3-text-bank.jsonl"), entries.join("\n") + "\n");
console.log(`Wrote ${entries.length} entries to _step3-text-bank.jsonl`);

// ── Write cluster assignments ──
fs.writeFileSync(path.join(BANK_DIR, "_step3-cluster-assignments.json"), JSON.stringify(clusterAssignments, null, 2));
console.log(`Wrote cluster assignments to _step3-cluster-assignments.json`);

// ── Summary ──
console.log(`\n=== SUMMARY ===`);
const sortedSets = Object.keys(clusterAssignments).sort((a, b) => Number(a) - Number(b));
for (const setId of sortedSets) {
  console.log(`  Set ${setId}: ${clusterAssignments[setId].length} nodes`);
}
