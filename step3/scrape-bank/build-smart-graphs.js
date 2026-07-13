#!/usr/bin/env node
/**
 * Smart classification for all 19 auto-sets (2–20).
 * Reads each question's likely answer + explanation, compares against scene hook,
 * generates meaningful why text. Three categories:
 *   primary  = the actual answer targets the core diagnostic fork
 *   mimic    = the answer targets a look-alike / alternative dx
 *   thread   = cross-scene systemic connection
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// ── Set definitions — core territory + scene-specific primary terms ──────────
const SET_DEFS = {
  2: {
    coreDiagnosis: 'Chest pain — ACS vs stable angina vs non-cardiac',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Chest pain entry', primaryTerms: ['acute coronary', 'myocardial infarct', 'unstable angina', 'troponin', 'stemi', 'nstemi', 'ecg changes', 'cardiac chest pain'] },
      { id: 2, title: 'Cardiac differential', primaryTerms: ['coronary arte', 'atherosclero', 'coronary angi', 'cardiac catheter', 'revascular', 'percutaneous', 'cabg', 'bypass'] },
      { id: 3, title: 'Non-cardiac mimics', primaryTerms: ['pericarditis', 'myocarditis', 'aortic dissect', 'pulmonary embol', 'pneumothorax', 'esophageal spasm', 'gerd', 'costochondritis'] },
      { id: 4, title: 'Risk and testing', primaryTerms: ['stress test', 'nuclear', 'echo', 'spect', 'ct angiography', 'calcium score', 'framingham', 'ascvd', 'coronary calcium'] },
      { id: 5, title: 'Long-term management', primaryTerms: ['statin', 'antiplatelet', 'aspirin', 'beta blocker', 'cardiac rehab', 'secondary prevention', 'mace', 'event'] },
    ],
  },
  3: {
    coreDiagnosis: 'Syncope — cardiac vs vasovagal vs orthostatic vs seizure',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Syncope entry', primaryTerms: ['syncope', 'loss of conscious', 'transient loss', 'faint', 'vasovagal', 'neurocardiogenic'] },
      { id: 2, title: 'Cardiac syncope', primaryTerms: ['arrhythmia', 'brugada', 'long qt', 'hypertrophic cardio', 'aortic stenosis', 'structural heart', 'torsade', 'ventricular'] },
      { id: 3, title: 'Orthostatic and autonomic', primaryTerms: ['orthostatic', 'postural', 'autonomic', 'dehydration', 'volume depletion', 'parkinson', 'diabetic neuropath'] },
      { id: 4, title: 'Seizure vs syncope', primaryTerms: ['seizure', 'epilep', 'convuls', 'postictal', 'eeg'] },
      { id: 5, title: 'Workup and disposition', primaryTerms: ['holter', 'event monitor', 'loop recorder', 'tilt table', 'electrophysi', 'ep study', 'pacemaker', 'implantable'] },
    ],
  },
  4: {
    coreDiagnosis: 'Anemia — microcytic vs macrocytic vs hemolytic vs anemia of chronic disease',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Anemia entry', primaryTerms: ['anemia', 'low hemoglobin', 'low hb', 'hematocrit', 'microcytic', 'iron deficien', 'ferritin', 'transferrin'] },
      { id: 2, title: 'Macrocytic anemia', primaryTerms: ['macrocytic', 'megaloblastic', 'b12', 'cobalamin', 'folate', 'pernicious', 'mds', 'myelodys'] },
      { id: 3, title: 'Hemolytic anemia', primaryTerms: ['hemolytic', 'hemolysis', 'haptoglobin', 'ldh', 'sickle', 'thalassemia', 'g6pd', 'hereditary spherocyt', 'autoimmune hemolytic'] },
      { id: 4, title: 'Anemia of chronic disease', primaryTerms: ['anemia of chronic', 'inflammatory', 'acd', 'chronic kidney', 'epo', 'erythropoietin', 'renal'] },
      { id: 5, title: 'Management and transfusion', primaryTerms: ['transfusion', 'packed rbc', 'iron supplement', 'ferrous', 'epoetin', 'darbepoetin', 'target hemoglobin'] },
    ],
  },
  5: {
    coreDiagnosis: 'Thyroid — hypothyroidism vs hyperthyroidism vs nodules vs cancer',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Hypothyroid', primaryTerms: ['hypothyroid', 'tsh', 'levothyroxine', 'myxedema', 'hashimoto', 'autoimmune thyroid'] },
      { id: 2, title: 'Hyperthyroid', primaryTerms: ['hyperthyroid', 'graves', 'thyrotoxic', 'radioactive iodine', 'methimazole', 'propylthiouracil', 'thyroid storm'] },
      { id: 3, title: 'Thyroid nodules', primaryTerms: ['thyroid nodule', 'fine needle', 'fna', 'bethesda', 'ultrasound thyr', 'papillary', 'follicular'] },
      { id: 4, title: 'Thyroid cancer', primaryTerms: ['thyroid cancer', 'medullary', 'anaplastic', 'calcitonin', 'thyroglobulin', 'lymph node metastasis'] },
      { id: 5, title: 'Follow-up and monitoring', primaryTerms: ['thyroid function', 'tsh monitoring', 'suppression', 'recurrence', 'surveillance', 'scan', 'uptake'] },
    ],
  },
  6: {
    coreDiagnosis: 'Dyspnea — pulmonary vs cardiac vs anemia vs anxiety',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Dyspnea entry', primaryTerms: ['dyspnea', 'shortness of breath', 'sob', 'respiratory', 'pulmonary', 'lung'] },
      { id: 2, title: 'Cardiac dyspnea', primaryTerms: ['heart fail', 'chf', 'cardiomyopathy', 'ejection fraction', 'bnp', 'pulmonary edema', 'cardiogenic'] },
      { id: 3, title: 'Pulmonary causes', primaryTerms: ['copd', 'asthma', 'pulmonary embol', 'pneumonia', 'interstitial', 'pulmonary fibros', 'pleural effusion'] },
      { id: 4, title: 'Other causes', primaryTerms: ['anemia', 'thyroid', 'metabolic acidosis', 'anxiety', 'panic', 'decondition', 'obesity', 'kyphoscoliosis'] },
      { id: 5, title: 'Workup and treatment', primaryTerms: ['chest x.?ray', 'pulmonary function', 'spirometry', 'echo', 'ct chest', 'oxygen', 'diuretic', 'bronchodilat'] },
    ],
  },
  7: {
    coreDiagnosis: 'Acute abdomen — surgical vs medical vs gynecologic vs vascular',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Acute abdomen entry', primaryTerms: ['acute abdomen', 'abdominal pain', 'peritonitis', 'guarding', 'rebound', 'rigidity'] },
      { id: 2, title: 'Surgical causes', primaryTerms: ['appendicitis', 'cholecystitis', 'bowel obstruct', 'perforat', 'volvulus', 'intussuscept', 'incarcerated hernia'] },
      { id: 3, title: 'Medical causes', primaryTerms: ['pancreatit', 'peptic ulcer', 'gastroenteritis', 'diverticulitis', 'ibd', 'crohn', 'colitis'] },
      { id: 4, title: 'Vascular and other', primaryTerms: ['mesenteric ischemia', 'aaa', 'abdominal aortic aneurysm', 'ruptured', 'ectopic', 'ovarian', 'torsion'] },
      { id: 5, title: 'Imaging and management', primaryTerms: ['ct abdomen', 'ultrasound', 'surgical consult', 'laparotomy', 'laparoscop', 'antibiotic', 'nil per os'] },
    ],
  },
  8: {
    coreDiagnosis: 'Jaundice — pre-hepatic vs hepatic vs post-hepatic',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Jaundice entry', primaryTerms: ['jaundice', 'icterus', 'bilirubin', 'yellow skin', 'scleral icterus'] },
      { id: 2, title: 'Pre-hepatic', primaryTerms: ['hemolytic', 'gilbert', 'unconjugated', 'indirect bilirub', 'crigler', 'hematoma resorption'] },
      { id: 3, title: 'Hepatic', primaryTerms: ['hepatitis', 'cirrhosis', 'alcoholic', 'drug.?induced liver', 'autoimmune hepati', 'wilson', 'hemochromatosis'] },
      { id: 4, title: 'Post-hepatic', primaryTerms: ['obstruct', 'choledocholith', 'pancreatic cancer', 'cholangiocarcinoma', 'stricture', 'ercp', 'stent'] },
      { id: 5, title: 'Workup and imaging', primaryTerms: ['ultrasound', 'mrcp', 'ercp', 'liver function', 'alt', 'ast', 'alkaline phosphatase', 'liver biopsy'] },
    ],
  },
  9: {
    coreDiagnosis: 'Headache — primary vs secondary vs thunderclap vs chronic',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Headache entry', primaryTerms: ['headache', 'migraine', 'tension', 'cluster', 'trigeminal', 'cephalalgia'] },
      { id: 2, title: 'Secondary headache', primaryTerms: ['subarachnoid', 'meningitis', 'encephalitis', 'tumor', 'mass', 'hydrocephalus', 'venous sinus thrombosis', 'temporal arteritis', 'giant cell'] },
      { id: 3, title: 'Thunderclap', primaryTerms: ['thunderclap', 'sentinel', 'subarachnoid hemorrhage', 'sah', 'aneurysm', 'rcvs', 'reversible cerebral vasoconstriction'] },
      { id: 4, title: 'Chronic and medication', primaryTerms: ['chronic migraine', 'medication overuse', 'rebound', 'preventive', 'prophylaxis', 'triptan'] },
      { id: 5, title: 'Imaging and red flags', primaryTerms: ['ct head', 'mri brain', 'lumbar puncture', 'angiography', 'mra', 'cta', 'papilledema', 'red flags'] },
    ],
  },
  10: {
    coreDiagnosis: 'Joint pain — inflammatory vs mechanical vs crystal vs infectious',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Joint pain entry', primaryTerms: ['joint pain', 'arthralgia', 'arthritis', 'inflammatory', 'rheumatoid', 'sle', 'lupus', 'autoimmune'] },
      { id: 2, title: 'Crystal arthritis', primaryTerms: ['gout', 'pseudogout', 'crystal', 'urate', 'uric acid', 'calcium pyrophosphate', 'monosodium urate', 'colchicine', 'allopurinol'] },
      { id: 3, title: 'Infectious arthritis', primaryTerms: ['septic arthrit', 'gonococcal', 'joint aspirat', 'synovial fluid', 'cell count', 'culture', 'gram stain'] },
      { id: 4, title: 'Mechanical and other', primaryTerms: ['osteoarthrit', 'degenerative', 'mechanical', 'overuse', 'trauma', 'meniscal', 'bursitis', 'tendinitis'] },
      { id: 5, title: 'Workup and management', primaryTerms: ['esr', 'crp', 'rheumatoid factor', 'anti.?ccp', 'ana', 'x.?ray', 'mri', 'dmard', 'nsaid', 'steroid'] },
    ],
  },
  11: {
    coreDiagnosis: 'Diabetes — DKA vs HHS vs hypoglycemia vs complications',
    recurringThread: 'Diabetes cascade — DKA/HHS → complications → infections',
    scenes: [
      { id: 1, title: 'Too much sugar', primaryTerms: ['dka', 'diabetic ketoacidosis', 'keton', 'anion gap', 'hhs', 'hyperosmolar', 'hyperglycemi', 'insulin deficien'] },
      { id: 2, title: 'Crash and sugar', primaryTerms: ['hypoglycemi', 'insulinoma', 'sulfonylurea', 'whipple', 'c.?peptide', 'proinsulin', 'octreotide', 'glucagon'] },
      { id: 3, title: 'Feet and eyes', primaryTerms: ['diabetic foot', 'ulcer', 'charcot', 'neuroarthropath', 'osteomyelit', 'wagner', 'retinopath', 'laser'] },
      { id: 4, title: 'Kidney complications', primaryTerms: ['diabetic nephropath', 'microalbumin', 'ace.?i', 'arb', 'gfr', 'creatinine', 'dialysis', 'hyperkalem'] },
      { id: 5, title: 'Infection and sugar', primaryTerms: ['mucormycosis', 'malignant otitis', 'necrotizing fasciitis', 'gas gangrene', 'diabetic infect', 'amphotericin', 'insulin manag'] },
    ],
  },
  12: {
    coreDiagnosis: 'Acid-Base — metabolic acidosis vs respiratory vs mixed vs RTA',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Low pH, low bicarb', primaryTerms: ['metabolic acidosis', 'anion gap', 'mudpiles', 'lactate', 'ketoacidosis', 'methanol', 'ethylene glycol', 'salicylate', 'osmolar gap'] },
      { id: 2, title: 'Normal gap acid', primaryTerms: ['renal tubular acidosis', 'rta', 'diarrhea', 'acetazolamide', 'hyperchloremic', 'non.?anion gap', 'urine anion gap'] },
      { id: 3, title: 'Respiratory drive', primaryTerms: ['respiratory acidosis', 'respiratory alkalosis', 'hypercapn', 'hypoventil', 'hyperventil', 'pco2', 'winter'] },
      { id: 4, title: 'Mixed disorder trap', primaryTerms: ['mixed acid.?base', 'concurrent', 'multiple', 'compensation', 'salicylate', 'sepsis'] },
      { id: 5, title: 'Electrolyte cascade', primaryTerms: ['rta', 'aldosterone', 'hyperkalemia', 'hypokalemia', 'fludrocortisone', 'spironolactone', 'distal nephron'] },
    ],
  },
  13: {
    coreDiagnosis: 'Electrolytes — sodium vs potassium vs calcium disorders',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Too much water', primaryTerms: ['hyponatremia', 'siadh', 'urine sodium', 'urine osmolal', 'tolvaptan', 'demeclocycline', 'hypovolemic'] },
      { id: 2, title: 'Overcorrected', primaryTerms: ['osmotic demyelination', 'central pontine', 'rapid correction', 'hypertonic saline', 'overcorrection'] },
      { id: 3, title: 'Thirst and water', primaryTerms: ['hypernatremia', 'diabetes insipidus', 'desmopressin', 'ddavp', 'polyuria', 'polydipsia'] },
      { id: 4, title: 'Heart on pause', primaryTerms: ['hyperkalemia', 'hypokalemia', 'ecg', 'peaked t', 'calcium gluconate', 'insulin glucose', 'kayexalate'] },
      { id: 5, title: 'Bone and beyond', primaryTerms: ['hypercalcemia', 'hyperparathyroid', 'malignancy', 'pthrp', 'vitamin d', 'bisphosphonate', 'calcitonin'] },
    ],
  },
  14: {
    coreDiagnosis: 'Stroke — ischemic vs hemorrhagic vs mimics',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'One sided weakness', primaryTerms: ['ischemic stroke', 'hemorrhagic', 'cva', 'tpa', 'alteplase', 'nihss', 'non.?contrast ct'] },
      { id: 2, title: 'Mimics that fool the ED', primaryTerms: ['seizure', 'postictal', 'migraine', 'hypoglycemia', 'conversion', 'functional', 'todd paralysis'] },
      { id: 3, title: 'Cardioembolic source', primaryTerms: ['atrial fib', 'pfo', 'patent foramen', 'endocarditis', 'echocardiogram', 'anticoagul'] },
      { id: 4, title: 'Vertebrobasilar vs carotid', primaryTerms: ['vertebrobasilar', 'posterior circulation', 'basilar', 'diplopia', 'dysarthria', 'ataxia', 'thrombectomy'] },
      { id: 5, title: 'What happens after', primaryTerms: ['carotid', 'antiplatelet', 'clopidogrel', 'statin', 'secondary prevention', 'rehabilitation', 'dysphagia'] },
    ],
  },
  15: {
    coreDiagnosis: 'Renal — AKI vs stones vs obstruction vs intrinsic',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Creatinine rising', primaryTerms: ['aki', 'acute kidney', 'prerenal', 'fena', 'atn', 'acute tubular', 'acute interstitial', 'ain', 'muddy brown'] },
      { id: 2, title: 'Glomerular crossroads', primaryTerms: ['nephritic', 'nephrotic', 'proteinuria', 'hematuria', 'minimal change', 'membranous', 'iga', 'goodpasture'] },
      { id: 3, title: 'Obstructed outflow', primaryTerms: ['obstruct', 'hydronephrosis', 'bph', 'nephrolith', 'ureteral stone', 'post.?void', 'stricture'] },
      { id: 4, title: 'Drug harm to the kidney', primaryTerms: ['aminoglycoside', 'contrast', 'nsaid', 'ace.?i', 'vancomycin', 'cisplatin', 'nephrotox'] },
      { id: 5, title: 'Who needs dialysis', primaryTerms: ['dialysis', 'hemodialysis', 'hyperkalemia', 'fluid overload', 'uremia', 'pericarditis', 'aeiou'] },
    ],
  },
  16: {
    coreDiagnosis: 'GI Bleed — upper vs lower vs variceal vs diverticular',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Blood from above or below', primaryTerms: ['upper gi bleed', 'hematemesis', 'coffee ground', 'melena', 'hematochezia', 'bun', 'endoscopy'] },
      { id: 2, title: 'Variceal storm', primaryTerms: ['varices', 'variceal', 'cirrhosis', 'portal', 'octreotide', 'banding', 'tips'] },
      { id: 3, title: 'Diverticular vs ischemic', primaryTerms: ['diverticul', 'angiodysplasia', 'ischemic colitis', 'colonoscopy', 'tagged rbc', 'ct angio'] },
      { id: 4, title: 'Young person with blood', primaryTerms: ['crohn', 'ulcerative colitis', 'infection', 'hemorrhoid', 'fissure', 'mesalamine', 'infliximab'] },
      { id: 5, title: 'Resuscitation and next steps', primaryTerms: ['ppi', 'pantoprazole', 'rockall', 'blatchford', 'transfusion', 'scope', 'helicobacter'] },
    ],
  },
  17: {
    coreDiagnosis: 'Arrhythmias — AFib vs SVT vs VTach vs heart block',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Irregularly irregular', primaryTerms: ['atrial fib', 'atrial flutter', 'rate control', 'rhythm control', 'chads', 'anticoagul', 'cardioversion'] },
      { id: 2, title: 'Fast and narrow', primaryTerms: ['svt', 'supraventricular', 'adenosine', 'vagal', 'wpw', 'delta wave', 'avnrt', 'avrt'] },
      { id: 3, title: 'Wide and fast', primaryTerms: ['ventricular tachy', 'vtach', 'ventricular fib', 'amiodarone', 'lidocaine', 'defibrillat', 'cpr'] },
      { id: 4, title: 'Pause and block', primaryTerms: ['heart block', 'wenckebach', 'mobitz', 'sick sinus', 'pacemaker', 'atropine', 'bradycardia'] },
      { id: 5, title: 'Long-term rhythm', primaryTerms: ['ablation', 'watchman', 'appendage', 'holter', 'loop recorder', 'pulmonary vein isolation'] },
    ],
  },
  18: {
    coreDiagnosis: 'Sepsis/Shock — distributive vs cardiogenic vs hypovolemic vs obstructive',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Low pressure, warm skin', primaryTerms: ['sepsis', 'septic shock', 'sirs', 'qsofa', 'lactate', 'vasopressor', 'norepinephrine', 'fluid resuscitation'] },
      { id: 2, title: 'Pump failure shock', primaryTerms: ['cardiogenic shock', 'tamponade', 'ejection fraction', 'dobutamine', 'inotrope', 'iabc', 'intra.?aortic'] },
      { id: 3, title: 'Empty tank', primaryTerms: ['hypovolemic', 'hemorrhagic', 'volume deplet', 'ivc', 'transfusion', 'passive leg raise'] },
      { id: 4, title: 'Clot in the lung', primaryTerms: ['obstructive shock', 'pulmonary emboli', 'tension pneumothorax', 'needle decomp', 'thrombolys', 'chest tube'] },
      { id: 5, title: 'Distributive mimics', primaryTerms: ['anaphylaxis', 'neurogenic shock', 'adrenal crisis', 'hydrocortisone', 'epinephrine', 'vasopressin'] },
    ],
  },
  19: {
    coreDiagnosis: 'Endocrine — adrenal crisis vs pituitary vs Cushing vs hyperaldosteronism',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'Hypotension unresponsive', primaryTerms: ['adrenal crisis', 'adrenal insufficienc', 'addison', 'cortisol', 'acth', 'hydrocortisone', 'fludrocortisone'] },
      { id: 2, title: 'Cushing faces', primaryTerms: ['cushing', 'dexamethasone', 'ectopic acth', 'hypercortisol', 'pituitary adenoma'] },
      { id: 3, title: 'Empty sella', primaryTerms: ['hypopituitarism', 'sheehan', 'pituitary apoplexy', 'empty sella', 'central hypothyroid'] },
      { id: 4, title: 'Too much aldosterone', primaryTerms: ['hyperaldosteron', 'conn', 'renin', 'liddle', 'spironolactone', 'eplerenone'] },
      { id: 5, title: 'Pheo and paraganglioma', primaryTerms: ['pheochromocytoma', 'paraganglioma', 'metanephrine', 'alpha block', 'phenoxybenzamine', 'paroxysmal'] },
    ],
  },
  20: {
    coreDiagnosis: 'Infectious disease — HIV vs TB vs fungal vs IRIS',
    recurringThread: '',
    scenes: [
      { id: 1, title: 'CD4 count tells the story', primaryTerms: ['hiv', 'aids', 'cd4', 'pneumocystis', 'pcp', 'cmv', 'toxoplasmo', 'cryptococca', 'mac'] },
      { id: 2, title: 'TB or not TB', primaryTerms: ['tuberculosis', 'tb ', 'igra', 'rifampin', 'isoniazid', 'cavitary', 'apical'] },
      { id: 3, title: 'Fungal deep dives', primaryTerms: ['aspergill', 'candida', 'histoplasma', 'coccidio', 'galactomannan', 'voriconazole', 'amphotericin'] },
      { id: 4, title: 'Fever of unknown origin', primaryTerms: ['fuo', 'fever of unknown', 'endocarditis', 'abscess', 'lymphoma', 'giant cell arteritis', 'pet.?ct'] },
      { id: 5, title: 'Immune reconstitution', primaryTerms: ['iris', 'immune reconstitution', 'art', 'haart', 'paradoxical', 'corticosteroid'] },
    ],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function extractItems(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const start = html.indexOf('const ITEMS = ') + 'const ITEMS = '.length;
  const end = html.lastIndexOf('];', html.indexOf('\nconst SCENES'));
  return JSON.parse(html.slice(start, end + 1));
}

function fullText(q) {
  const ans = (q.answers || []).map(a => (a.text || a.label || '')).join(' ');
  return `${q.question} ${ans} ${q.explanation} ${q.likely}`.toLowerCase();
}

function likelyText(q) {
  // Resolve q.likely (e.g. "D.") to the actual answer text
  const letter = String(q.likely || '').replace(/[^a-z]/gi, '').toUpperCase();
  const ans = (q.answers || []).find(a => String(a.label || '').replace(/[^a-z]/gi, '').toUpperCase() === letter);
  return (ans && ans.text ? ans.text : '').toLowerCase();
}

function classifyQuestion(q, sceneDef, setNum) {
  const txt = fullText(q);
  const likely = likelyText(q);
  const expl = (q.explanation || '').toLowerCase();
  const primaryTerms = sceneDef.primaryTerms;
  const setDef = SET_DEFS[setNum];

  // ── Score: how strongly does this question match the scene's core fork? ──
  let primaryScore = 0;
  let bestPrimaryMatch = '';
  // Build all primary terms across ALL scenes (so "Aortic dissection" in S3 terms
  // can still label a S1 chest-pain Q as primary)
  const allPrimaryTerms = setDef
    ? [...new Set(setDef.scenes.flatMap(s => s.primaryTerms))]
    : [...primaryTerms];
  for (const pt of allPrimaryTerms) {
    const re = new RegExp(pt, 'i');
    if (re.test(likely)) {
      // The likely/correct answer directly names the condition → strong primary
      const s = primaryTerms.includes(pt) ? 7 : 5;
      if (s > primaryScore) { primaryScore = s; bestPrimaryMatch = pt; }
    } else if (re.test(txt)) {
      const s = primaryTerms.includes(pt) ? 2 : 1;
      if (s > primaryScore && primaryScore < 5) { primaryScore = s; bestPrimaryMatch = pt; }
    }
  }

  // ── Detect cross-scene connections (mention of ANOTHER scene's core territory) ──
  let otherSceneCount = 0;
  let otherSceneExample = '';
  if (setDef) {
    for (const sc of setDef.scenes) {
      if (sc.id === sceneDef.id) continue;
      let found = false;
      for (const pt of sc.primaryTerms) {
        if (new RegExp(pt, 'i').test(txt)) {
          found = true;
          if (!otherSceneExample) otherSceneExample = pt;
          break;
        }
      }
      if (found) otherSceneCount++;
    }
  }

  // ── Decision ──
  if (primaryScore >= 5) {
    return {
      category: 'primary',
      why: `Directly tests ${bestPrimaryMatch} — core diagnostic fork of ${sceneDef.title}`,
    };
  }

  // Only classify as thread if it genuinely bridges to another scene AND isn't primary
  if (otherSceneCount >= 1 && primaryScore < 5) {
    return {
      category: 'thread',
      why: `Cross-scene connection: bridges ${sceneDef.title} to ${otherSceneExample} territory across another scene`,
    };
  }

  // ── Mimic: identify what alternative condition it's actually testing ──
  let mimicLabel = '';
  // Extract the diagnosis from the likely answer or explanation
  for (const pt of primaryTerms) {
    if (new RegExp('\\b' + pt + '\\b', 'i').test(expl)) {
      mimicLabel = pt;
      break;
    }
  }
  if (!mimicLabel && likely.length > 3 && likely.length < 80) {
    mimicLabel = likely;
  }

  if (mimicLabel) {
    return {
      category: 'mimic',
      why: `Differential look-alike in ${sceneDef.title}: tests ${mimicLabel} which mimics the core fork`,
    };
  }

  return {
    category: 'mimic',
    why: `Differential distractor — alternative condition to the ${sceneDef.title} fork`,
  };
}

function buildEdges(items, nodes) {
  const edges = [];
  for (let sid = 1; sid <= 5; sid++) {
    const inScene = items.filter((q) => q.sceneId === sid);
    for (let i = 0; i < inScene.length; i++) {
      for (let j = i + 1; j < inScene.length; j++) {
        edges.push({ source: String(inScene[i].id), target: String(inScene[j].id), kind: 'scene' });
      }
    }
  }
  const primary = nodes.filter(n => n.category === 'primary');
  for (let i = 0; i < primary.length; i++) {
    for (let j = i + 1; j < primary.length; j++) {
      edges.push({ source: primary[i].id, target: primary[j].id, kind: 'thread', category: 'primary' });
    }
  }
  const thread = nodes.filter(n => n.category === 'thread');
  for (let i = 0; i < thread.length; i++) {
    for (let j = i + 1; j < thread.length; j++) {
      edges.push({ source: thread[i].id, target: thread[j].id, kind: 'thread', category: 'thread' });
    }
  }
  return edges;
}

function buildGraphJson(setNum) {
  const setDef = SET_DEFS[setNum];
  if (!setDef) throw new Error('No definition for Set ' + setNum);

  // Find story file
  const suffix = setNum <= 5 ? 'va' : (setNum <= 10 ? 'vb' : (setNum <= 15 ? 'va' : 'vb'));
  const storyFile = `set-${String(setNum).padStart(2, '0')}-story-${suffix}.html`;
  const storyPath = path.join(ROOT, storyFile);
  if (!fs.existsSync(storyPath)) throw new Error('Missing story file: ' + storyFile);

  const items = extractItems(storyPath);
  const nodes = [];
  const mainPath = [];

  for (const q of items) {
    const sceneDef = setDef.scenes.find(s => s.id === q.sceneId);
    const classification = classifyQuestion(q, sceneDef || { id: q.sceneId, title: '', primaryTerms: [] }, setNum);
    const node = {
      id: String(q.id),
      category: classification.category,
      why: classification.why || '',
    };
    nodes.push(node);
    if (classification.category === 'primary') mainPath.push(String(q.id));
  }

  const edges = buildEdges(items, nodes);
  const counts = {
    primary: nodes.filter(n => n.category === 'primary').length,
    mimic: nodes.filter(n => n.category === 'mimic').length,
    thread: nodes.filter(n => n.category === 'thread').length,
  };

  return {
    set: setNum,
    storyFile,
    source: 'smart-classifier: likely-answer vs scene-differential terms. Master review recommended.',
    repo: 'https://github.com/stefopps/MeWorld (step3/scrape-bank)',
    coreDiagnosis: setDef.coreDiagnosis,
    recurringThread: setDef.recurringThread || '',
    mainPath,
    generatedAt: new Date().toISOString(),
    counts,
    nodes,
    edges,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('=== Smart Classification — Sets 2–20 ===\n');

const allGraphData = [];

for (let sn = 2; sn <= 20; sn++) {
  try {
    const graph = buildGraphJson(sn);
    const outFile = `graph-data-set-${String(sn).padStart(2, '0')}.json`;
    fs.writeFileSync(path.join(ROOT, outFile), JSON.stringify(graph, null, 2));
    console.log(`Set ${sn}: ${graph.counts.primary}P · ${graph.counts.mimic}M · ${graph.counts.thread}T  (${graph.coreDiagnosis})  → ${outFile}`);

    // Show a few sample why texts
    const primary = graph.nodes.filter(n => n.category === 'primary');
    const thread = graph.nodes.filter(n => n.category === 'thread');
    if (primary.length > 0) console.log(`  primary example: ${primary[0].id} — ${primary[0].why}`);
    if (thread.length > 0) console.log(`  thread example: ${thread[0].id} — ${thread[0].why}`);

    allGraphData.push(graph);
  } catch (e) {
    console.error(`Set ${sn} FAILED: ${e.message}`);
  }
}

// Update unified manifest
let md = `# Graph-data manifest (auto-classified, Sets 1–20)

| Set | Spine | P | M | T | File |
|-----|-------|---|---|---|------|
`;
for (const g of allGraphData) {
  md += `| ${g.set} | ${g.coreDiagnosis} | ${g.counts.primary} | ${g.counts.mimic} | ${g.counts.thread} | \`${g.storyFile}\` |\n`;
}
md += `
**Set 1** is hand-crafted (see \`graph-data-set-01.json\`).
**Sets 2–20** are auto-classified by matching question likely-answer text against scene diagnostic terms.
Each node has a \`why\` field explaining its classification.

Re-run: \`node build-smart-graphs.js\`
`;
fs.writeFileSync(path.join(ROOT, 'graph-manifest-1-20.md'), md);

console.log(`\nDone. ${allGraphData.length} sets classified.`);
