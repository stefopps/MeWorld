// cluster-project-based-v3.js
// Improved similarity scoring + iterative cluster expansion.
// Uses: sharper score spread, top-K neighbor edges only, and density-gated growth.

const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/steve/MeWorld/step3/scrape-bank';
const OUT_DIR = path.join(ROOT, 'output-recluster');
const TEXT_BANK = JSON.parse(fs.readFileSync(path.join(ROOT, 'text-bank.json'), 'utf8'));

// ── Locked Sets 1-20 ──
const SETS_1_20_QIDS = new Set();
for (let i = 1; i <= 20; i++) {
  const pad = String(i).padStart(2, '0');
  const f = path.join(ROOT, 'graph-data-set-' + pad + '.json');
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  (d.nodes || []).forEach(n => SETS_1_20_QIDS.add(String(n.id)));
}
console.log('Sets 1-20 locked:', SETS_1_20_QIDS.size, 'Qs');

const pool = TEXT_BANK.filter(q => !SETS_1_20_QIDS.has(String(q.id)));
console.log('Available pool:', pool.length, 'Qs');

// ── Clinical vocabulary ──
const CHIEF_COMPLAINTS = {
  'chest pain': ['chest pain','chest discomfort','chest pressure','substernal','retrosternal','angina'],
  'dyspnea': ['shortness of breath','dyspnea','difficulty breathing','breathless','sob','trouble breathing','air hunger'],
  'abd pain': ['abdominal pain','stomach pain','belly pain','epigastric','ruq pain','luq pain','rlq pain','llq pain'],
  'headache': ['headache','migraine','throbbing','photophobia'],
  'fever': ['fever','febrile','temperature','pyrexia'],
  'nausea-vomiting': ['nausea','vomiting','emesis','vomited'],
  'cough': ['cough','coughing','hemoptysis','sputum product'],
  'joint pain': ['joint pain','joint swelling','arthralgia','morning stiffness'],
  'fatigue': ['fatigue','tiredness','exhaustion','lethargy','malaise'],
  'bleeding': ['bleeding','hemorrhage','blood loss','hematemesis','melena','rectal bleed'],
  'syncope': ['syncope','fainted','fainting','passed out','loss of consciousness','blackout'],
  'seizure': ['seizure','convulsion','convulsing','epileptic'],
  'rash': ['rash','skin lesion','dermatitis','urticaria','hives','eczema','pruritic'],
  'edema': ['edema','swelling','swollen','anasarca','pitting edema'],
  'confusion': ['confusion','delirium','altered mental status','disorientation','ams'],
  'palpitations': ['palpitations','racing heart','heart racing','pounding heart'],
  'weight loss': ['weight loss','unintentional weight loss','cachexia'],
  'back pain': ['back pain','lumbar','sciatica','spine pain'],
  'urinary': ['dysuria','hematuria','polyuria','oliguria','anuria','urinary retention','incontinence','flank pain'],
  'trauma': ['trauma','injury','motor vehicle','gunshot','stab wound','blunt trauma','fall from'],
};

const BODY_SYSTEMS = {
  'cardio': ['heart failure','chf','cardiomyopathy','valvular','arrhythmia','afib','vtach','vfib','pericarditis','myocarditis','endocarditis','mi','myocardial','cad','coronary','aortic stenosis','mitral regur','aortic regur','tricuspid','cardiac output','cardiogenic shock','tamponade','pericardial effusion','ecg','echocardiogram','troponin','bnp','chest xray cardiomeg'],
  'resp': ['pneumonia','copd','asthma','pulmonary edema','ards','pneumothorax','pulmonary embol','pleural effusion','sarcoid','fibrosis','bronchitis','bronchiectasis','spirometry','oxygen sat','chest xray','ct chest','pft','ventilator','intubated'],
  'gi': ['gi bleed','peptic ulcer','gastric','esophageal varices','mallory','boerhaave','cirrhosis','hepatitis','liver fail','ascites','pancreatitis','gallbladder','cholecyst','bile duct','cholangi','cholang','sibo','ibd','crohn','ulcerative colitis','diverticul','appendicitis','bowel obstruction','ileus','volvulus','malabsorption','celiac'],
  'neuro': ['stroke','cva','tia','ischemic','intracranial hemorrhage','sah','subdural','epidural','meningitis','encephalitis','seizure','epilepsy','status epilepticus','neuropathy','myelopathy','radiculopathy','als','multiple sclerosis','parkinson','dementia','delirium','myasthenia gravis','guillain','ct head','mri brain','lumbar puncture','eeg','nuchal rigidity','papilledema'],
  'renal': ['aki','acute kidney injury','ckd','chronic kidney disease','dialysis','creatinine','gfr','hydronephrosis','nephrolith','kidney stone','pyelonephritis','cystitis','uti','nephritic','nephrotic','glomerulonephritis','proteinuria','renal vein thrombos','rhabdomyolysis','urinalysis','bun','electrolyte'],
  'heme': ['anemia','iron deficiency','b12 deficiency','folate deficiency','thalassemia','sickle cell','hemolysis','g6pd','dic','coagulopathy','thrombocytopenia','thrombocytosis','hemophilia','von willebrand','dvt','deep vein','pulmonary embolism','anticoagulant','warfarin','heparin','doac','transfuse','pt','ptt','inr','fibrinogen','d-dimer','platelet count','hemoglobin','hematocrit','peripheral smear','bone marrow'],
  'endo': ['diabetes','dka','hhs','hyperglycemia','hypoglycemia','insulin','metformin','thyroid','hypothyroid','hyperthyroid','graves','hashimoto','addison','cushing','hyperaldosteronism','pheochromocytoma','pituitary adenoma','hyperparathyroid','calcium','pth','hyponatremia','hypernatremia','hypokalemia','hyperkalemia','siadh','diabetes insipidus','osteoporosis'],
  'obgyn': ['pregnancy','pregnant','antenatal','prenatal','postpartum','fetal','amniotic','placenta','preeclampsia','eclampsia','ectopic','molar pregnancy','iugr','gdm','gestational','macrosomia','oligohydramnios','polyhydramnios','cervical insufficiency','mastitis','endometritis','pid','pcos','endometriosis','fibroids','leiomyoma','abnormal uterine bleed','menorrhagia','menopause','hrt','ocp','ovarian torsion'],
  'id': ['sepsis','septic','bacteremia','cellulitis','abscess','osteomyelitis','endocarditis','meningitis','encephalitis','hiv','opportunistic','tb','tuberculosis','malaria','dengue','lyme','syphilis','gonorrhea','chlamydia','herpes','covid','pneumocystis','cmv','ebv','antibiotic','vancomycin','ceftriax','piperacillin','tazobactam','meropenem','culture','gram stain','pcr','crp','procalcitonin','wbc','leukocytosis','neutropenia'],
  'onc': ['carcinoma','sarcoma','lymphoma','leukemia','melanoma','myeloma','glioblastoma','metastatic','metastasis','chemotherapy','radiation','adjuvant','palliative','hospice','biopsy','tumor marker','ca-125','cea','psa','paraneoplastic','tumor lysis','febrile neutropenia'],
  'psych': ['depression','anxiety','bipolar','mania','schizophrenia','psychosis','suicidal','substance use','alcohol use disorder','opioid use','stimulant','withdrawal','delirium tremens','overdose','ptsd','ocd','adhd','eating disorder','anorexia','bulimia','ssri','sertraline','lithium','antipsychotic','clozapine','olanzapine','quetiapine'],
  'derm': ['rash','eczema','psoriasis','acne','cellulitis','abscess','urticaria','melanoma','basal cell','squamous cell','actinic keratosis','stevens johnson','toxic epidermal','dermatitis','vitiligo','alopecia','onychomycosis','tinea','scabies'],
};

function extractFingerprint(q) {
  const stem = q.question.toLowerCase();
  const first250 = stem.slice(0, 250);

  const chiefComplaints = [];
  for (const [label, patterns] of Object.entries(CHIEF_COMPLAINTS)) {
    for (const p of patterns) {
      if (first250.includes(p)) { chiefComplaints.push(label); break; }
    }
  }

  const systems = [];
  for (const [sys, terms] of Object.entries(BODY_SYSTEMS)) {
    let count = 0;
    for (const t of terms) {
      if (stem.includes(t)) count++;
    }
    if (count >= 2) systems.push(sys);
  }

  const ageMatch = first250.match(/(\d+)[-\s]year[s]?[-\s]old/);
  const age = ageMatch ? parseInt(ageMatch[1]) : null;
  const isPregnant = first250.includes('pregnan');
  const isPediatric = /(infant|newborn|neonate|toddler|child|adolescent|pediatric)/.test(first250);
  const isED = /(emergency department|emergency room|emergent|sudden onset|acute onset|brought to the)/.test(first250);

  // Diagnostic entities from answer set
  const answerTexts = (q.answers || []).map(a => (a.text || '').toLowerCase());
  const allAnswerText = answerTexts.join(' ');

  // Extract condition categories from answer text
  const answerCats = [];
  const CAT_PATTERNS = {
    'mi/acs': /(myocardial infarct|acute coronary|unstable angina|stemi|nstemi|prinzmetal)/,
    'pe/dvt': /(pulmonary embol|deep vein thrombos|venous thromboembol)/,
    'pneumonia': /(pneumonia|community-acquired|hospital-acquired|ventilator-associated)/,
    'hf': /(heart failure|cardiogenic|chf|congestive)/,
    'copd/asthma': /(copd|asthma|chronic obstruct|bronchospasm|exacerbation)/,
    'cirrhosis/liver': /(cirrhosis|hepatic fail|hepatorenal|spontaneous bacterial peritonitis)/,
    'ra/ctd': /(rheumatoid|sle|lupus|scleroderma|sjogren|mixed connective)/,
    'stroke': /(ischemic stroke|hemorrhagic stroke|transient ischemic|cva)/,
    'meningitis/encephalitis': /(meningitis|encephalitis|cns infection|meningoencephal)/,
    'sepsis': /(sepsis|septic shock|bacteremia|sirs)/,
    'preeclampsia/eclampsia': /(preeclamp|eclamp|hellp)/,
    'dka/hhs': /(diabetic ketoacidosis|hyperosmolar|dka)/,
    'siadh/di': /(siadh|diabetes insipidus)/,
    'bowel obstruction': /(bowel obstruction|intestinal obstruction|volvulus)/,
    'pancreatitis': /(pancreatitis)/,
    'cholecystitis': /(cholecystitis|biliary colic)/,
    'appendicitis': /(appendicitis)/,
    'diverticulitis': /(diverticulitis)/,
    'uti/pyelonephritis': /(urinary tract infect|pyelonephritis|cystitis)/,
    'aki/ckd': /(acute kidney injury|chronic kidney disease|acute renal fail)/,
    'anemia': /(iron deficiency|megaloblastic|hemolytic|aplastic|anemia of chronic)/,
    'coagulopathy': /(dic|coagulopathy|hemophilia|von willebrand|disseminated intravascular)/,
    'thyroid': /(hypothyroid|hyperthyroid|thyroid storm|myxedema|graves|hashimoto)/,
    'psychosis/schizo': /(schizophrenia|schizophreniform|psychotic disorder|brief psychotic)/,
    'depression': /(major depressive|persistent depressive|depressive disorder)/,
    'anxiety': /(generalized anxiety|panic disorder|social anxiety|phobia)/,
    'substance': /(alcohol use|alcohol withdrawal|opioid|stimulant|cocaine|methamphetamine|intoxication)/,
  };

  for (const [cat, re] of Object.entries(CAT_PATTERNS)) {
    if (re.test(allAnswerText)) answerCats.push(cat);
  }

  return {
    id: String(q.id),
    chiefComplaints,
    systems,
    answerCats,
    age,
    isPregnant,
    isPediatric,
    isED,
    stemLength: stem.length,
  };
}

// ── Similarity (sharper spread, 0-25 range) ──
function scenarioSimilarity(a, b) {
  let score = 0;

  // Chief complaint match: +7 each (strong signal)
  for (const cc of a.chiefComplaints) {
    if (b.chiefComplaints.includes(cc)) score += 7;
  }

  // Body system overlap: +3 each
  for (const s of a.systems) {
    if (b.systems.includes(s)) score += 3;
  }

  // Answer-category overlap: +8 each (diagnostic confusion is the MOST important signal)
  for (const ac of a.answerCats) {
    if (b.answerCats.includes(ac)) score += 8;
  }

  // Demographics: +2 for same patient type
  if (a.isPregnant && b.isPregnant) score += 2;
  if (a.isPediatric && b.isPediatric) score += 2;
  if (a.isED && b.isED) score += 2;
  if (a.age && b.age && Math.abs(a.age - b.age) <= 10) score += 1;

  return score;
}

// ── Phase 2: Compute similarities (bucketed, top-K edges only) ──
console.log('Fingerprinting...');
const fingerprints = pool.map(q => extractFingerprint(q));

// How many have chief complaints? answer cats?
const withCC = fingerprints.filter(f => f.chiefComplaints.length > 0).length;
const withAC = fingerprints.filter(f => f.answerCats.length > 0).length;
const withSys = fingerprints.filter(f => f.systems.length > 0).length;
console.log('Fingerprints with chief complaints:', withCC, '/', fingerprints.length);
console.log('Fingerprints with answer cats:', withAC, '/', fingerprints.length);
console.log('Fingerprints with body systems:', withSys, '/', fingerprints.length);

// Bucket by chief complaint + answer cat for efficiency
const buckets = {};
for (const fp of fingerprints) {
  const keys = [];
  if (fp.chiefComplaints.length > 0) {
    // Each chief complaint is its own bucket
    for (const cc of fp.chiefComplaints) keys.push('cc:' + cc);
  }
  if (fp.answerCats.length > 0) {
    for (const ac of fp.answerCats) keys.push('ac:' + ac);
  }
  if (fp.systems.length > 0) {
    for (const sys of fp.systems) keys.push('sys:' + sys);
  }
  if (keys.length === 0) keys.push('unkeyed');

  for (const k of keys) {
    if (!buckets[k]) buckets[k] = [];
    buckets[k].push(fp);
  }
}
console.log('Buckets:', Object.keys(buckets).length);

// Build k-nearest-neighbor graph (k = 15)
const K = 15;
const GRAPH_THRESHOLD = 8; // minimum score to even consider an edge

const neighbors = new Map();
for (const fp of fingerprints) neighbors.set(fp.id, []);

let totalCompared = 0;
for (const [bucketKey, bucket] of Object.entries(buckets)) {
  if (bucket.length < 2) continue;
  for (let i = 0; i < bucket.length; i++) {
    for (let j = i + 1; j < bucket.length; j++) {
      totalCompared++;
      const sim = scenarioSimilarity(bucket[i], bucket[j]);
      if (sim >= GRAPH_THRESHOLD) {
        neighbors.get(bucket[i].id).push({ id: bucket[j].id, score: sim });
        neighbors.get(bucket[j].id).push({ id: bucket[i].id, score: sim });
      }
    }
  }
}

// Keep only top-K neighbors per node
let edgeCount = 0;
for (const [id, nbrs] of neighbors) {
  nbrs.sort((a, b) => b.score - a.score);
  const topK = nbrs.slice(0, K);
  neighbors.set(id, topK);
  edgeCount += topK.length;
}

console.log('Comparisons:', totalCompared.toLocaleString(), '; edges:', edgeCount / 2);

// ── Phase 3: Iterative cluster expansion ──
// 1. Find seeds: clusters of 3+ questions where all pairwise sim >= 12
// 2. Grow each cluster by adding Qs that are similar to >= 50% of existing members at sim >= 8

const EXPAND_HIGH = 11;
const EXPAND_GROW = 8;

// Build seed clusters
const allIds = new Set(fingerprints.map(f => f.id));
const used = new Set();
const seeds = [];

// Sort nodes by best-neighbor count to find good seeds
const nodeOrder = [...neighbors.entries()]
  .map(([id, nbrs]) => ({ id, nbrs: nbrs.filter(n => n.score >= EXPAND_HIGH), allNbrs: nbrs }))
  .sort((a, b) => b.nbrs.length - a.nbrs.length);

for (const node of nodeOrder) {
  if (used.has(node.id)) continue;
  if (node.nbrs.length < 2) continue;

  // Start a seed cluster with this node's high-confidence neighbors
  const seed = [node.id];
  used.add(node.id);

  for (const { id: nid } of node.nbrs) {
    if (used.has(nid)) continue;
    // Check: is nid also connected to the seed at EXPAND_HIGH?
    const nNbrs = (neighbors.get(nid) || []).filter(n => n.score >= EXPAND_HIGH);
    let shared = 0;
    for (const { id: snid } of nNbrs) {
      if (seed.includes(snid)) shared++;
    }
    if (shared >= 1) {
      seed.push(nid);
      used.add(nid);
    }
  }

  if (seed.length >= 3) seeds.push(seed);
}

console.log('Seeds (high-confidence clusters >= 3):', seeds.length,
  '; largest:', Math.max(...seeds.map(s => s.length)));

// Grow seeds
const clusters = [];

for (const seed of seeds) {
  const cluster = new Set(seed);
  let changed = true;
  let iter = 0;

  while (changed && iter < 10) {
    changed = false;
    iter++;

    for (const candidateId of allIds) {
      if (cluster.has(candidateId) || used.has(candidateId) && !cluster.has(candidateId)) continue;

      const cNbrs = (neighbors.get(candidateId) || []).filter(n => n.score >= EXPAND_GROW);
      let hits = 0;
      const clusterArr = [...cluster];
      const targetHits = Math.ceil(clusterArr.length * 0.5); // 50% threshold

      for (const { id: nid } of cNbrs) {
        if (cluster.has(nid)) hits++;
        if (hits >= targetHits) break;
      }

      if (hits >= targetHits && hits >= 2) {
        cluster.add(candidateId);
        used.add(candidateId);
        changed = true;
      }
    }
  }

  // Mark as consumed
  for (const id of cluster) used.add(id);

  if (cluster.size >= 5) {
    clusters.push([...cluster]);
  }
}

clusters.sort((a, b) => b.length - a.length);
console.log('Grown clusters >= 5:', clusters.length);

// Also mine remaining unused Qs for smaller clusters
const unusedIds = new Set(allIds);
for (const c of clusters) for (const id of c) unusedIds.delete(id);
  console.log('Unused Qs after first pass:', unusedIds.size);

  // Second pass: topic-based scenario bucketing for remaining Qs (always run)
  if (unusedIds.size > 0) {
    console.log('\nSecond pass — scenario-level clustering for', unusedIds.size, 'remaining Qs...');

    // Take remaining unused fingerprints
    const unusedFps = fingerprints.filter(f => unusedIds.has(f.id));

    // Bucket by: chief_complaint × body_system × setting
    // This creates "clinical scenario" clusters that share the same encounter type
    const scenarioBuckets = {};
    for (const fp of unusedFps) {
      const ccKey = fp.chiefComplaints.length > 0 ? fp.chiefComplaints[0] : 'unspecified';
      const sysKey = fp.systems.length > 0 ? fp.systems[0] : 'unspecified';
      const setKey = fp.isPediatric ? 'peds' : fp.isPregnant ? 'ob' : 'adult';
      const key = ccKey + '||' + sysKey + '||' + setKey;

      if (!scenarioBuckets[key]) scenarioBuckets[key] = [];
      scenarioBuckets[key].push(fp);
    }

    console.log('Scenario buckets:', Object.keys(scenarioBuckets).length);

    // Phase A: large buckets (5+ Qs same scenario) become second-tier clusters
    const tier2Added = new Set();
    for (const [key, bucket] of Object.entries(scenarioBuckets)) {
      if (bucket.length >= 6) {
        // Split large buckets into sub-clusters of 10-30 Qs
        const sorted = bucket.sort((a, b) => (a.systems[1] || '').localeCompare(b.systems[1] || ''));
        for (let i = 0; i < bucket.length; i += 25) {
          const chunk = sorted.slice(i, i + 25);
          if (chunk.length >= 6) {
            const ids = chunk.map(fp => fp.id);
            clusters.push(ids);
            for (const id of ids) { unusedIds.delete(id); tier2Added.add(id); }
          }
        }
      }
    }

    // Phase B: merge small buckets by body system + setting
    const remainingFps = unusedFps.filter(fp => !tier2Added.has(fp.id));
    const sysSetBuckets = {};
    for (const fp of remainingFps) {
      const sysKey = fp.systems.length > 0 ? fp.systems[0] : 'unspecified';
      const setKey = fp.isPediatric ? 'peds' : fp.isPregnant ? 'ob' : 'adult';
      const key = sysKey + '||' + setKey;

      if (!sysSetBuckets[key]) sysSetBuckets[key] = [];
      sysSetBuckets[key].push(fp);
    }

    for (const [key, bucket] of Object.entries(sysSetBuckets)) {
      if (bucket.length >= 6 && bucket.length <= 40) {
        const ids = bucket.map(fp => fp.id);
        clusters.push(ids);
        for (const id of ids) { unusedIds.delete(id); }
      }
    }

    console.log('Second-pass scenario clusters added. Unused remaining:', unusedIds.size);
  }

// Sort final clusters
clusters.sort((a, b) => b.length - a.length);

// ── Phase 4: Build sets from clusters ──
console.log('\n=== Building sets ===');

let setNum = 21;
const newSets = [];
const allClustered = new Set();

for (const clusterIds of clusters) {
  if (clusterIds.length < 6) continue;
  const cFps = clusterIds.map(id => fingerprints.find(f => f.id === id)).filter(Boolean);

  const items = cFps.map(fp => {
    const q = pool.find(qq => String(qq.id) === fp.id);
    return q ? { ...q, id: String(q.id) } : null;
  }).filter(Boolean);

  if (items.length < 6) continue;

  // Limit to 40 Qs per set
  const setItems = items.slice(0, 40);

  // Scene sub-clustering (use GROW threshold, not HIGH)
  const itemFps = setItems.map(q => ({ q, fp: fingerprints.find(f => f.id === q.id) })).filter(x => x.fp);
  const sceneAssigned = new Set();
  const subGroups = [];

  for (const item of itemFps) {
    if (sceneAssigned.has(item.q.id)) continue;
    const group = [item];
    sceneAssigned.add(item.q.id);

    for (const other of itemFps) {
      if (sceneAssigned.has(other.q.id)) continue;
      // Use GROW threshold for scene sub-grouping
      if (scenarioSimilarity(item.fp, other.fp) >= EXPAND_GROW) {
        group.push(other);
        sceneAssigned.add(other.q.id);
      }
    }
    subGroups.push(group);
  }

  subGroups.sort((a, b) => b.length - a.length);

  // If the largest group dominates (> 60%), cluster is too homogeneous for natural scenes.
  // Use heuristic split by chief complaint + system instead.
  const largestGroupSize = subGroups.length > 0 ? subGroups[0].length : 0;
  let sceneGroups;

  if (largestGroupSize >= setItems.length * 0.6 && setItems.length >= 8) {
    const sorted = [...itemFps].sort((a, b) => {
      const ccA = a.fp.chiefComplaints.join(',');
      const ccB = b.fp.chiefComplaints.join(',');
      if (ccA !== ccB) return ccA.localeCompare(ccB);
      return a.fp.systems.join(',').localeCompare(b.fp.systems.join(','));
    });
    const numScenes = Math.min(5, Math.max(2, Math.ceil(sorted.length / 8)));
    const perScene = Math.ceil(sorted.length / numScenes);
    sceneGroups = [];
    for (let i = 0; i < sorted.length; i += perScene) {
      if (sceneGroups.length >= 5) break;
      sceneGroups.push(sorted.slice(i, Math.min(i + perScene, sorted.length)));
    }
  } else {
    sceneGroups = subGroups.slice(0, 5).filter(g => g.length >= 2);
  }

  if (sceneGroups.length < 2) continue;

  const scenes = [];
  for (const sg of sceneGroups) {
    scenes.push(sg.map(x => x.q).slice(0, 8));
  }

  // Scene titles
  const sceneTitles = sceneGroups.slice(0, scenes.length).map(sg => {
    const ccs = [...new Set(sg.flatMap(x => x.fp.chiefComplaints))].slice(0, 2);
    const sys = [...new Set(sg.flatMap(x => x.fp.systems))].slice(0, 1);
    const acs = [...new Set(sg.flatMap(x => x.fp.answerCats))].slice(0, 2);
    return [...ccs, ...acs, ...sys].filter(Boolean).join(' / ') || 'Cluster';
  });

  // Primary/mimic
  const mainPath = [];
  const nodes = [];
  for (let si = 0; si < scenes.length; si++) {
    const sqs = scenes[si];
    const scored = sqs.map(q => {
      const fp = fingerprints.find(f => f.id === q.id);
      return { q, score: (fp ? fp.systems.length * 2 + fp.chiefComplaints.length * 3 + fp.answerCats.length * 3 : 0) };
    }).sort((a, b) => b.score - a.score);

    const primaryCount = Math.min(2, scored.length);
    for (let pi = 0; pi < primaryCount; pi++) {
      scored[pi].q.category = 'primary';
      scored[pi].q.sceneId = si + 1;
      mainPath.push(String(scored[pi].q.id));
      nodes.push({ id: String(scored[pi].q.id), category: 'primary', why: `Core diagnostic fork: scene ${si+1}` });
    }
    for (let mi = primaryCount; mi < scored.length; mi++) {
      scored[mi].q.category = 'mimic';
      scored[mi].q.sceneId = si + 1;
      nodes.push({ id: String(scored[mi].q.id), category: 'mimic', why: `Differential door in scene ${si+1}` });
    }
  }

  const allCCs = [...new Set(cFps.flatMap(f => f.chiefComplaints))];
  const allACs = [...new Set(cFps.flatMap(f => f.answerCats))];
  const allSys = [...new Set(cFps.flatMap(f => f.systems))];
  const coreDiag = [...allCCs.slice(0, 1), ...allACs.slice(0, 2), ...allSys.slice(0, 1)].filter(Boolean).join(' · ') || 'Scenario cluster';

  // Edges
  const edges = [];
  for (let si = 0; si < scenes.length; si++) {
    const sqs = scenes[si];
    for (let i = 0; i < sqs.length; i++) {
      for (let j = i + 1; j < sqs.length; j++) {
        edges.push({ source: String(sqs[i].id), target: String(sqs[j].id), kind: 'scene' });
      }
    }
  }
  for (let i = 0; i < mainPath.length; i++) {
    for (let j = i + 1; j < mainPath.length; j++) {
      edges.push({ source: mainPath[i], target: mainPath[j], kind: 'thread', category: 'primary' });
    }
  }

  const graphData = {
    set: setNum,
    storyFile: `set-${String(setNum).padStart(2, '0')}-story-va.html`,
    source: 'project-based clustering v3 (iterative expansion + answer-cat overlap)',
    repo: 'https://github.com/stefopps/MeWorld (step3/scrape-bank)',
    coreDiagnosis: coreDiag,
    recurringThread: allACs.filter(Boolean).join(' > ') || allSys.join(' > '),
    mainPath,
    generatedAt: new Date().toISOString(),
    counts: { primary: mainPath.length, mimic: nodes.filter(n => n.category === 'mimic').length, thread: 0 },
    nodes,
    edges,
  };

  for (const id of clusterIds) allClustered.add(id);
  const flatItems = scenes.flat();
  if (flatItems.length < 6) continue;  // Final quality gate

  newSets.push({ setNum, items: flatItems, graphData, sceneTitles, scenes });
  setNum++;
}

const unclusteredIds = [...allIds].filter(id => !allClustered.has(id));
console.log('\n=== SUMMARY ===');
console.log('New sets:', newSets.length);
const sizes = newSets.map(s => s.items.length);
if (sizes.length > 0) {
  console.log('Sizes: min', Math.min(...sizes), 'max', Math.max(...sizes), 'avg', Math.round(sizes.reduce((a,b)=>a+b,0)/sizes.length));
}
console.log('Clustered Qs:', allClustered.size);
console.log('Unclustered pool:', unclusteredIds.length);

console.log('\n=== Sample clusters ===');
newSets.slice(0, 15).forEach(s => {
  console.log(`Set ${s.setNum} (${s.items.length} Qs): ${s.graphData.coreDiagnosis.slice(0, 80)}`);
  s.scenes.forEach((sqs, si) => {
    console.log(`  Scene ${si+1} "${s.sceneTitles[si]}": ${sqs.length} Qs`);
  });
});

// ── Write output ──
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

let report = `# Project-Based Re-Clustering v3 — Summary Report
> Generated: ${new Date().toISOString()}
> Script: \`cluster-project-based-v3.js\`
> Method: Iterative cluster expansion from high-confidence seed pairs, with answer-category overlap as primary signal.

## Overview

| Metric | Value |
|--------|-------|
| Total bank | 4,852 |
| Locked Sets 1-20 | 800 |
| Available pool | 4,052 |
| **New sets produced** | **${newSets.length}** |
| Questions clustered | ${allClustered.size} |
| Unclustered pool | ${unclusteredIds.length} |
| Set size range | ${sizes.length ? Math.min(...sizes) + '-' + Math.max(...sizes) : 'N/A'} |
| Avg set size | ${sizes.length ? Math.round(sizes.reduce((a,b)=>a+b,0)/sizes.length) : 'N/A'} |

## Sample Clusters

`;

newSets.slice(0, 30).forEach(s => {
  report += `### Set ${s.setNum}: ${s.graphData.coreDiagnosis.slice(0, 80)} (${s.items.length} Qs)\n`;
  report += `- Primary: ${s.graphData.counts.primary}, Mimic: ${s.graphData.counts.mimic}\n`;
  s.scenes.forEach((sqs, si) => {
    report += `- Scene ${si+1} "${s.sceneTitles[si]}" — ${sqs.length} Qs\n`;
  });
  report += '\n';
});

report += `## All Sets\n`;
newSets.forEach(s => {
  report += `- Set ${s.setNum}: ${s.graphData.coreDiagnosis.slice(0, 60)} (${s.items.length} Qs)\n`;
});

report += `\n## Unclustered Pool: ${unclusteredIds.length} questions\n\n`;
report += `These questions could not cluster into project-based sets of ≥ 6 questions. Most are genuine "standalone"\n`;
report += `test items without plausible clinical-scenario neighbors.\n`;
report += `They remain in the pool for manual review or assignment into existing sets where a reviewer\n`;
report += `identifies a missed scenario connection.\n`;

fs.writeFileSync(path.join(OUT_DIR, 'RECLUSTER_REPORT.md'), report, 'utf8');

// Write files
for (const s of newSets) {
  const pad = String(s.setNum).padStart(2, '0');
  fs.writeFileSync(path.join(OUT_DIR, 'graph-data-set-' + pad + '.json'), JSON.stringify(s.graphData, null, 2) + '\n', 'utf8');

  const itemsJs = JSON.stringify(s.items.map(q => {
    const ni = s.graphData.nodes.find(n => n.id === String(q.id)) || {};
    return { id: String(q.id), question: q.question, answers: q.answers, explanation: q.explanation, likely: q.likely, sceneId: ni.sceneId || 1, indexInScene: ni.indexInScene || 1, category: ni.category || 'mimic' };
  }));

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Set ${s.setNum} — ${s.graphData.coreDiagnosis.slice(0, 50)}</title>
<style>body{font-family:Inter,sans-serif;max-width:900px;margin:40px auto;padding:0 20px}h1{font-size:1.3rem}.scene{margin:20px 0;padding:16px;border:1px solid #e2e4e9;border-radius:8px}.stitle{font-weight:700;font-size:.9rem;color:#2563eb}.q{margin:8px 0;font-size:.8rem}</style></head>
<body><h1>Set ${s.setNum}: ${s.graphData.coreDiagnosis.slice(0, 80)}</h1>
<p>Primary: ${s.graphData.counts.primary} · Mimic: ${s.graphData.counts.mimic} · Source: iterative cluster expansion</p>
${s.scenes.map((sqs,si) => `<div class="scene"><div class="stitle">Scene ${si+1}: ${s.sceneTitles[si]}</div>${sqs.map(q => `<div class="q"><strong>Q${q.id}</strong> — ${q.question.slice(0,120)}…</div>`).join('\n')}</div>`).join('\n')}
<script>const SCENES=${JSON.stringify(s.sceneTitles)};const ITEMS=${itemsJs};</script></body></html>`;
  fs.writeFileSync(path.join(OUT_DIR, 'set-' + pad + '-story-va.html'), html, 'utf8');
}

console.log(`\nOutput: ${newSets.length} sets written to ${OUT_DIR}/`);
console.log('IMPORTANT: Existing Set 21+ files NOT overwritten. Review first.');
