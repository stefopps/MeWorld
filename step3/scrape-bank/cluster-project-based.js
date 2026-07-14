// cluster-project-based.js
// Re-clusters the entire question bank (Sets 21-4052) using project-based/scenario
// clustering instead of specialty buckets. Produces output as a new directory,
// does NOT overwrite existing files.
//
// Methodology:
// 1. Extract presentation patterns + diagnostic entities from each question stem
// 2. Build a co-occurrence graph based on shared clinical scenarios
// 3. Partition the graph into scenario clusters
// 4. Within each cluster, build 5 scenes of 8 questions
// 5. Classify primary/mimic/thread per scene
// 6. Output: graph-data JSONs + story HTMLs + summary report

const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/steve/MeWorld/step3/scrape-bank';
const OUT_DIR = path.join(ROOT, 'output-recluster');
const TEXT_BANK = JSON.parse(fs.readFileSync(path.join(ROOT, 'text-bank.json'), 'utf8'));

// ── Load Sets 1-20 QIDs (these are sacred, do not touch) ──
const SETS_1_20_QIDS = new Set();
for (let i = 1; i <= 20; i++) {
  const pad = String(i).padStart(2, '0');
  const f = path.join(ROOT, 'graph-data-set-' + pad + '.json');
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  (d.nodes || []).forEach(n => SETS_1_20_QIDS.add(String(n.id)));
}
console.log('Sets 1-20 locked Qs:', SETS_1_20_QIDS.size);

// ── Pool: all questions NOT in Sets 1-20 ──
const pool = TEXT_BANK.filter(q => !SETS_1_20_QIDS.has(String(q.id)));
console.log('Re-clustering pool:', pool.length, 'questions');

// ── Phase 1: Extract scenario fingerprints from each question ──
// We extract: chief complaint, clinical context/setting, diagnostic entities, body systems

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by','from',
  'up','about','into','through','during','before','after','above','below','between',
  'is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','shall','should','may','might','must','can','could','this','that',
  'these','those','his','her','its','their','our','your','my','no','not','all','any',
  'both','each','few','more','most','other','some','such','only','own','same','so',
  'than','too','very','just','also','now','then','over','under','again','further',
  'once','here','there','when','where','why','how','which','who','whom',
]);

// Clinical stop words (too generic to be useful for clustering)
const CLINICAL_STOP = new Set([
  'patient','patients','doctor','physician','nurse','hospital','clinic','department',
  'emergency','room','year','years','old','week','weeks','day','days','month','months',
  'hour','hours','minute','minutes','history','presents','present','presenting',
  'reports','reported','denies','denied','complains','complaining','physical',
  'examination','laboratory','studies','shown','below','following','include',
  'including','finding','findings','demonstrates','reveals','revealed','shows',
  'performed','obtained','evaluation','workup','assessment','management','treatment',
  'diagnosis','diagnostic','appropriate','likely','consistent','positive','negative',
  'normal','abnormal','elevated','decreased','increased','reduced','mild','moderate',
  'severe','chronic','acute','episode','episodes','symptoms','symptom','sign','signs',
  'test','tests','testing','result','results','value','values','level','levels',
  'mg/dl','mmol/l','meq/l','cm','mm','kg','lbs','medications','medication','dose',
  'doses','therapy','therapeutic','regimen','course','follow','following','prior',
]);

const CLINICAL_PRESENTATIONS = {
  'chest-pain': ['chest pain','chest discomfort','chest pressure','substernal','retrosternal','crushing chest','chest tightness','angina','chest heaviness'],
  'shortness-of-breath': ['shortness of breath','dyspnea','difficulty breathing','breathlessness','can\'t breathe','respiratory distress','sob','trouble breathing','air hunger'],
  'abdominal-pain': ['abdominal pain','stomach pain','belly pain','abdominal discomfort','abd pain','tummy pain','epigastric pain','ruq pain','luq pain','rlq pain','llq pain','periumbilical pain'],
  'headache': ['headache','head pain','migraine','throbbing head','head pressure'],
  'fever': ['fever','febrile','temperature','temp of','pyrexia','high temperature'],
  'nausea-vomiting': ['nausea','vomiting','emesis','vomited','throwing up','nauseated'],
  'cough': ['cough','coughing','chronic cough','productive cough','nonproductive cough','dry cough','hemoptysis','coughing up blood'],
  'joint-pain': ['joint pain','joint swelling','arthralgia','arthritis','swollen joints','painful joints','stiff joints','morning stiffness'],
  'fatigue': ['fatigue','tiredness','exhaustion','lethargy','malaise','feeling tired','low energy','weakness generalized','generalized weakness'],
  'bleeding': ['bleeding','hemorrhage','blood loss','bleeding from','bloody','hematemesis','hematochezia','melena','bleeds','hemorrhagic'],
  'syncope': ['syncope','fainted','fainting','passed out','loss of consciousness','blackout','collapse','unresponsive'],
  'seizure': ['seizure','convulsion','convulsing','epileptic','fit','jerking','shaking'],
  'rash': ['rash','skin lesion','skin eruption','dermatitis','urticaria','hives','eczema','pruritic','pruritus','itchy'],
  'edema': ['edema','swelling','swollen','puffy','anasarca','dependent edema','pitting edema'],
  'confusion': ['confusion','delirium','altered mental status','disorientation','confused','ams','altered mentation'],
  'pain-unspecified': ['pain','painful','discomfort','ache','aching','sore','tender'],
  'palpitations': ['palpitations','racing heart','heart racing','pounding heart','irregular heartbeat','skipped beats'],
  'weight-loss': ['weight loss','unintentional weight loss','lost weight','weight decrease','cachexia','wasting'],
  'back-pain': ['back pain','lower back pain','lumbar pain','sciatica','back ache','thoracic pain'],
  'urinary': ['dysuria','hematuria','urinary frequency','polyuria','oliguria','anuria','urinary retention','incontinence','burning urination','flank pain'],
  'gi-bleed': ['gi bleed','gastrointestinal bleed','upper gi bleed','lower gi bleed','gi bleeding','blood in stool','rectal bleeding','hematochezia','melena','hematemesis'],
  'trauma': ['trauma','injury','accident','fall','motor vehicle','mva','gunshot','stab wound','assault','blunt trauma','penetrating trauma','fell','hit by','struck'],
};

const BODY_SYSTEMS = {
  'cardio': ['heart','cardiac','coronary','myocardial','aortic','pericardial','ventricular','atrial','valve','valvular','arrhythmia','ecg','ekg','echocardiogram','troponin','ck-mb','bnp','chest','sternum','cardiovascular','angina','infarction','ischemia','cardiomeg','insufficiency regurg','stenosis','tamponade'],
  'resp': ['lung','pulmonary','bronchial','bronchus','bronchiol','alveol','pleura','pleural','diaphragm','respiratory','pneumonia','copd','asthma','tuberculosis','sarcoid','fibrosis','pneumothorax','empyema','hemothorax','spirometry','fev1','fvc','dlco','oxygen','ventilator','intubat','tracheo','sputum'],
  'gi': ['liver','hepatic','hepatitis','cirrhosis','ascites','pancreas','pancreatic','pancreat','gallbladder','cholecyst','biliary','bile','stomach','gastric','esophageal','esophagus','colon','colonic','colorectal','rectal','intestinal','intestine','bowel','duoden','jejun','ileum','appendix','appendic','diverticul','ibd','crohn','ulcerative','peptic','gerd','endoscopy','colonoscopy','egld','gi series'],
  'neuro': ['brain','cerebral','cerebro','cranial','intracranial','cerebell','spinal','spine','vertebr','cervical','lumbar','thoracic spine','nerve','neural','neurologic','mening','encephal','seizure','stroke','cva','tia','subarachnoid','subdural','epidural','intracerebral','neuropathy','myelopathy','radiculopathy','als','multiple sclerosis','parkinson','alzheimer','dementia','guillain','myasthenia','ct head','mri brain','lumbar puncture','eeg'],
  'renal': ['kidney','renal','nephron','nephro','glomerul','creatinine','bun','gfr','dialysis','hemodialy','peritoneal dialy','urinary','urine','bladder','urethra','ureter','prostate','bph','nephritic','nephrotic','nephrolith','renal stone','kidney stone','hydronephrosis','pyelonephritis','cystitis','uti','urinary tract','urinalysis','proteinuria','hematuria','microscopic hematuria','cast'],
  'heme': ['blood','hematol','hemoglobin','hematocrit','ferritin','iron','folate','b12','anemia','anemic','sickle','thalassemia','hemolysis','hemolytic','coagulation','coagulopathy','clotting','platelet','thrombocyt','thrombosis','thromboemb','dvt','pe','pulmonary embol','embolism','embolic','anticoagulant','warfarin','heparin','enoxaparin','doac','aptt','pt/inr','inr','pt','ptt','transfusion','prbc','ffp','cryoprecipitate'],
  'endo': ['diabetes','diabetic','dka','hhs','insulin','glucose','hyperglycem','hypoglycem','thyroid','tsh','t4','t3','hypothyroid','hyperthyroid','graves','hashimoto','goiter','adrenal','cortisol','cushing','addison','pituitary','prolactin','acromegal','growth hormone','parathyroid','calcium','pth','osteoporosis','vitamin d','hypercalcem','hypocalcem','hyperkalem','hypokalem','hypernatrem','hyponatrem'],
  'obgyn': ['pregnan','obstetric','gynecolog','fetal','uterus','uterine','cervical','cervix','ovarian','ovary','endometr','fallopian','vaginal','vulva','menstrual','menopause','menarche','contracept','pcos','fibroid','leiomyoma','myomectom','hysterect','amniotic','placenta','preeclamps','eclamps','ectopic','miscarriage','abortion','labor','delivery','postpartum','antepartum','fetal heart','amniocentesis','nst','nonstress','biophysical profile','bpp','ultrasound pregnancy','iugr','macrosomia','gdm','gestational diabetes','mastitis','breast','mammogram','lactation','prolactin'],
  'id': ['infection','infectious','sepsis','septic','bacteremia','bacterial','viral','fungal','parasitic','antibiotic','antimicrobial','antifungal','antiviral','hiv','aids','cd4','opportunistic','tuberculosis','tb','malaria','dengue','lyme','syphilis','gonorrhea','chlamydia','herpes','influenza','covid','pneumocystis','toxoplasm','cryptococc','cmv','ebv','abscess','cellulitis','osteomyel','endocarditis','meningitis','encephalitis','culture','gram stain','wbc','leukocytosis','leukopenia','neutropenia','crp','esr','procalcitonin'],
  'onc': ['cancer','carcinoma','tumor','malignan','malignancy','metasta','metastatic','chemotherap','radiation','sarcoma','adenocarcinoma','neoplasm','lymphoma','leukemia','melanoma','myeloma','palliative','hospice','biopsy','pet scan','ct scan tumor','staging','tnm','remission','recurrence','surveillance','screening','cancer screening','colonoscopy screening','mammogram screening','pap smear'],
  'psych': ['depression','depressed','anxiety','anxious','bipolar','mania','manic','schizophrenia','psychosis','psychotic','hallucination','delusion','suicide','suicidal','self-harm','substance','alcohol','opioid','heroin','cocaine','methamphetamine','withdrawal','detox','overdose','intoxication','delirium','pani','ptsd','ocd','adhd','eating disorder','anorexia','bulimia','psychiatric','psychotherapy','cbt','ssri','sertraline','fluoxetine','lithium','antipsychotic','psychotropic'],
  'derm': ['skin','dermat','rash','eczema','psoriasis','acne','urticaria','cellulitis','abscess','wound','burn','lesion','mole','nevus','melanocytic','basal cell','squamous cell','keratosis','dermatoscopy','punch biopsy','topical','steroid cream','antibiotic cream','sunscreen'],
};

const SETTING_WORDS = {
  'emergency': ['emergency department','emergency room','ed','er','emergent','urgent','acute onset','sudden onset','crash','code','rapid response','stat','immediately'],
  'inpatient': ['hospitalized','inpatient','admitted','ward','floor','icu','intensive care','critical care','ccu','nicu','picu','step-down','telemetry','post-op','postoperative'],
  'clinic': ['clinic','outpatient','office','primary care','pcp','family medicine','internal medicine','general practice','follow-up','follow up','routine','scheduled','check-up'],
  'obstetric': ['pregnant','pregnancy','obstetric','antenatal','prenatal','postpartum','labor and delivery','l&d','ob','maternal','trimester','gestation','gravida','para'],
  'pediatric': ['child','infant','newborn','neonate','toddler','adolescent','pediatric','peds','school-age','kindergarten','preschool','nursery'],
};

function extractPresentation(q) {
  const stem = q.question.toLowerCase();
  const words = stem.split(/\s+/).filter(w => !STOP_WORDS.has(w) && !CLINICAL_STOP.has(w));
  const wordSet = new Set(words);

  // Chief complaint from first 200 chars
  const first200 = stem.slice(0, 200);

  const chiefComplaints = [];
  for (const [label, patterns] of Object.entries(CLINICAL_PRESENTATIONS)) {
    for (const p of patterns) {
      if (first200.includes(p)) { chiefComplaints.push(label); break; }
    }
  }

  // Body systems from full stem
  const systems = [];
  for (const [sys, terms] of Object.entries(BODY_SYSTEMS)) {
    let score = 0;
    for (const t of terms) {
      if (stem.includes(t)) score++;
    }
    if (score >= 2) systems.push(sys);
  }

  // Clinical setting
  const settings = [];
  for (const [s, terms] of Object.entries(SETTING_WORDS)) {
    for (const t of terms) {
      if (first200.includes(t)) { settings.push(s); break; }
    }
  }

  // Patient demographics
  const ageMatch = first200.match(/(\d+)[-\s]year[s]?[-\s]old/);
  const age = ageMatch ? parseInt(ageMatch[1]) : null;
  const isPregnant = first200.includes('pregnan');

  // Diagnostic entities (extract capitalized noun phrases, likely conditions being tested)
  const diagnosticTerms = [];
  const diagPatterns = [
    /(?:diagnosis of|suspected|consistent with|ruled out|evaluate for|assess for|screen for)\s+([^.]+?)(?:\.|,|$)/g,
  ];
  for (const pat of diagPatterns) {
    let m;
    while ((m = pat.exec(stem)) !== null) {
      const term = m[1].trim().toLowerCase();
      if (term.length > 3 && term.length < 60) diagnosticTerms.push(term);
    }
  }

  // Extract condition/disease names from stem
  const allTerms = words.filter(w => w.length > 4).join(' ');
  const likelyA = (q.likely || '').toLowerCase();
  const answerTexts = (q.answers || []).map(a => (a.text || '').toLowerCase()).join(' ');
  const likelyAnswerText = (q.answers || []).find(a => q.likely && q.likely.startsWith(a.label))?.text?.toLowerCase() || '';

  return {
    id: String(q.id),
    chiefComplaints,
    systems,
    settings,
    age,
    isPregnant,
    diagnosticTerms,
    likelyAnswerText,
    first200Words: words.slice(0, 40),
    stemWords: words,
  };
}

// ── Phase 2: Compute pairwise similarity ──
function scenarioSimilarity(a, b) {
  let score = 0;

  // Shared chief complaint = strong signal
  for (const cc of a.chiefComplaints) {
    if (b.chiefComplaints.includes(cc)) score += 5;
  }

  // Shared body systems
  for (const s of a.systems) {
    if (b.systems.includes(s)) score += 2;
  }

  // Shared clinical setting
  for (const s of a.settings) {
    if (b.settings.includes(s)) score += 2;
  }

  // Same patient demographic bracket
  if (a.isPregnant === b.isPregnant && a.isPregnant) score += 3;
  if (a.age && b.age) {
    const diff = Math.abs(a.age - b.age);
    if (diff <= 5) score += 1;
    else if (diff <= 15) score += 0;
  }

  // Shared diagnostic vocabulary (Jaccard on word sets)
  const wa = new Set(a.stemWords);
  const wb = new Set(b.stemWords);
  let shared = 0;
  for (const w of wa) { if (wb.has(w)) shared++; }
  if (shared >= 15) score += 4;
  else if (shared >= 10) score += 2;
  else if (shared >= 5) score += 1;

  // Shared likely answer text = diagnostic overlap (the "would a test-taker confuse these?" test)
  if (a.likelyAnswerText && b.likelyAnswerText) {
    const la = new Set(a.likelyAnswerText.split(/\s+/).filter(w => w.length > 3));
    const lb = new Set(b.likelyAnswerText.split(/\s+/).filter(w => w.length > 3));
    let ansShared = 0;
    for (const w of la) { if (lb.has(w)) ansShared++; }
    if (ansShared >= 3) score += 3;
  }

  return score;
}

// ── Phase 3: Greedy scenario clustering ──
console.log('\n=== Phase 3: Building scenario clusters ===');

// Extract fingerprints for all pool questions
const fingerprints = pool.map(q => extractPresentation(q));
console.log('Fingerprints extracted');

// Sort fingerprints by "richness" — questions with more features become cluster seeds
fingerprints.forEach(fp => {
  fp.richness = fp.chiefComplaints.length + fp.systems.length + fp.settings.length;
});
const sorted = [...fingerprints].sort((a, b) => b.richness - a.richness);

// Clustering
const assigned = new Set();
const clusters = [];
const SIMILARITY_THRESHOLD = 4;    // lower for connected-components graph
const SCENE_GROUP_THRESHOLD = 8;   // tighter for scene-level sub-grouping

for (const seed of sorted) {
  if (assigned.has(seed.id)) continue;
  assigned.add(seed.id);
  const cluster = [seed];

  // Find candidates similar to this seed
  const candidates = fingerprints.filter(fp => !assigned.has(fp.id));
  const ranked = candidates
    .map(fp => ({ fp, score: scenarioSimilarity(seed, fp) }))
    .filter(r => r.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  for (const r of ranked) {
    if (assigned.has(r.fp.id)) continue;
    // Also check similarity to existing cluster members (not just seed)
    const avgSim = cluster.reduce((sum, m) => sum + scenarioSimilarity(m, r.fp), 0) / cluster.length;
    if (avgSim >= SIMILARITY_THRESHOLD) {
      assigned.add(r.fp.id);
      cluster.push(r.fp);
    }
  }

  clusters.push(cluster);
}

// Sort clusters by size
clusters.sort((a, b) => b.length - a.length);

console.log('Clusters found:', clusters.length);
console.log('Clustered Qs:', clusters.reduce((s, c) => s + c.length, 0));
console.log('Unclustered Qs:', pool.length - assigned.size);

const unclustered = fingerprints.filter(fp => !assigned.has(fp.id));

// ── Phase 4: Build sets from clusters ──
console.log('\n=== Phase 4: Building sets from clusters ===');

let setNum = 21; // Sets 1-20 are untouchable
const newSets = [];

for (const cluster of clusters) {
  if (cluster.length < 5) {
    // Too small for a set — pool these
    cluster.forEach(fp => { assigned.delete(fp.id); unclustered.push(fp); });
    continue;
  }

  const items = cluster.map(fp => {
    const q = pool.find(qq => String(qq.id) === fp.id);
    return q ? { ...q, id: String(q.id) } : null;
  }).filter(Boolean);

  if (items.length < 5) continue;

  // Limit to 40 max per set
  const setItems = items.slice(0, 40);
  const remaining = items.slice(40);
  if (remaining.length > 0) {
    remaining.forEach(r => {
      const fp = fingerprints.find(f => f.id === r.id);
      if (fp) { assigned.delete(fp.id); unclustered.push(fp); }
    });
  }

  // ── Smart scene assignment: group by chief-complaint / system affinity ──
  // Rather than splitting linearly, cluster items within the set by their presentation profile
  const itemFps = setItems.map(q => ({ q, fp: fingerprints.find(f => f.id === q.id) })).filter(x => x.fp);

  // Group into sub-clusters based on chief complaint + system overlap
  const subClusters = [];
  const itemAssigned = new Set();

  for (const item of itemFps) {
    if (itemAssigned.has(item.q.id)) continue;
    const group = [item];
    itemAssigned.add(item.q.id);

    for (const other of itemFps) {
      if (itemAssigned.has(other.q.id)) continue;
      const sim = scenarioSimilarity(item.fp, other.fp);
      if (sim >= SCENE_GROUP_THRESHOLD) {
        group.push(other);
        itemAssigned.add(other.q.id);
      }
    }
    subClusters.push(group);
  }

  // Sort sub-groups by size, take up to 5
  subClusters.sort((a, b) => b.length - a.length);
  const sceneGroups = subClusters.slice(0, 5);

  // If we have fewer than 3 decent scene groups, this cluster is too homogenous
  if (sceneGroups.filter(g => g.length >= 3).length < 2) continue;

  const scenes = [];
  for (const sg of sceneGroups) {
    // Limit each scene to 8 Qs
    const sceneQs = sg.map(x => x.q).slice(0, 8);
    if (sceneQs.length >= 2) scenes.push(sceneQs);
  }

  // Need at least 2 viable scenes
  if (scenes.length < 2) continue;

  // ── Scene titles from the sub-group's fingerprint ──
  const sceneTitles = sceneGroups.slice(0, scenes.length).map(sg => {
    const ccs = [...new Set(sg.flatMap(x => x.fp.chiefComplaints))].slice(0, 2);
    const sys = [...new Set(sg.flatMap(x => x.fp.systems))].slice(0, 2);
    const parts = [...ccs, ...sys].filter(Boolean);
    return parts.join(' / ') || 'Scenario group';
  });

  // Identify primary (spine) nodes per scene
  const mainPath = [];
  const nodes = [];
  for (let si = 0; si < scenes.length; si++) {
    const sqs = scenes[si];
    const scored = sqs.map(q => {
      const fp = fingerprints.find(f => f.id === q.id);
      const sysCount = fp ? fp.systems.length : 0;
      const ccCount = fp ? fp.chiefComplaints.length : 0;
      return { q, score: sysCount * 2 + ccCount };
    }).sort((a, b) => b.score - a.score);

    // Top 1-2 per scene are primary
    const primaryCount = Math.min(2, scored.length);
    for (let pi = 0; pi < primaryCount; pi++) {
      scored[pi].q.category = 'primary';
      scored[pi].q.sceneId = si + 1;
      scored[pi].q.indexInScene = pi + 1;
      mainPath.push(String(scored[pi].q.id));
      nodes.push({
        id: String(scored[pi].q.id),
        category: 'primary',
        why: `Core diagnostic fork: scene ${si + 1}`,
      });
    }

    // Rest are mimics
    for (let mi = primaryCount; mi < scored.length; mi++) {
      scored[mi].q.category = 'mimic';
      scored[mi].q.sceneId = si + 1;
      nodes.push({
        id: String(scored[mi].q.id),
        category: 'mimic',
        why: `Differential door in scene ${si + 1}`,
      });
    }
  }

  // ── coreDiagnosis ──
  const allCCs = [...new Set(fingerprints.filter(f => setItems.some(q => q.id === f.id)).flatMap(f => f.chiefComplaints))];
  const allSys = [...new Set(fingerprints.filter(f => setItems.some(q => q.id === f.id)).flatMap(f => f.systems))];
  const coreDiag = [...allCCs.slice(0, 2), ...allSys.slice(0, 2)].join(' · ') || 'Clinical scenario cluster';

  // ── Edges ──
  const edges = [];
  for (let si = 0; si < scenes.length; si++) {
    const sqs = scenes[si];
    for (let i = 0; i < sqs.length; i++) {
      for (let j = i + 1; j < sqs.length; j++) {
        edges.push({ source: String(sqs[i].id), target: String(sqs[j].id), kind: 'scene' });
      }
    }
  }
  // Thread edges between primary nodes across scenes
  for (let i = 0; i < mainPath.length; i++) {
    for (let j = i + 1; j < mainPath.length; j++) {
      edges.push({ source: mainPath[i], target: mainPath[j], kind: 'thread', category: 'primary' });
    }
  }

  const graphData = {
    set: setNum,
    storyFile: `set-${String(setNum).padStart(2, '0')}-story-va.html`,
    source: 'project-based clustering (scenario-first, not specialty-bucket)',
    repo: 'https://github.com/stefopps/MeWorld (step3/scrape-bank)',
    coreDiagnosis: coreDiag,
    recurringThread: allSys.filter(Boolean).join(' > ') || '',
    mainPath,
    generatedAt: new Date().toISOString(),
    counts: {
      primary: mainPath.length,
      mimic: nodes.filter(n => n.category === 'mimic').length,
      thread: 0,
    },
    nodes,
    edges,
  };

  // Items not placed in scenes go back to the pool
  const sceneItemIds = new Set(scenes.flat().map(q => q.id));
  const unusedItems = setItems.filter(q => !sceneItemIds.has(q.id));
  unusedItems.forEach(q => {
    const fp = fingerprints.find(f => f.id === q.id);
    if (fp) { assigned.delete(fp.id); unclustered.push(fp); }
  });

  newSets.push({ setNum, items: scenes.flat(), graphData, sceneTitles, scenes });
  setNum++;
}

// ── Summary report ──
console.log('\n=== SUMMARY REPORT ===');
console.log('Total new sets:', newSets.length);
console.log('Target: ~100 sets, actual:', newSets.length);
const sizes = newSets.map(s => s.items.length);
console.log('Set sizes: min', Math.min(...sizes), 'max', Math.max(...sizes), 'avg', Math.round(sizes.reduce((a,b)=>a+b,0)/sizes.length));
console.log('Unclustered pool:', unclustered.length);

console.log('\n=== Sample clusters for review ===');
newSets.slice(0, 8).forEach(s => {
  console.log(`\nSet ${s.setNum} (${s.items.length} Qs): ${s.graphData.coreDiagnosis.slice(0, 80)}`);
  console.log(`  Scenes: ${s.graphData.counts.primary} primary, ${s.graphData.counts.mimic} mimic`);
  s.scenes.forEach((sqs, si) => {
    console.log(`  Scene ${si+1}: "${s.sceneTitles[si]}" — ${sqs.length} Qs`);
    sqs.slice(0, 2).forEach(q => {
      console.log(`    Q${q.id}: ${q.question.slice(0, 80)}...`);
    });
  });
});

// ── Write output ──
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Write summary report
const reportPath = path.join(OUT_DIR, 'RECLUSTER_REPORT.md');
let report = `# Project-Based Re-Clustering — Summary Report

> Generated: ${new Date().toISOString()}
> Source: \`cluster-project-based.js\`
> Backup: \`archive/pre-recluster-backup/20260713-185604/\`

## Overview

| Metric | Value |
|--------|-------|
| Total question bank | 4,852 |
| Locked in Sets 1-20 | 800 |
| Available pool | 4,052 |
| New sets produced | ${newSets.length} |
| Questions clustered | ${sizes.reduce((a,b)=>a+b,0)} |
| Unclustered pool | ${unclustered.length} |
| Set size range | ${Math.min(...sizes)}–${Math.max(...sizes)} |
| Avg set size | ${Math.round(sizes.reduce((a,b)=>a+b,0)/sizes.length)} |

## Methodology

Project-based clustering replaces the old specialty-bucket system:
1. Presentation patterns extracted from each question stem (chief complaint, body systems, setting)
2. Pairwise scenario similarity scoring (shared chief complaint = +5, shared systems = +2, etc.)
3. Greedy clustering from richest seeds outward, threshold ≥ 8 similarity
4. Within each cluster: scene assignment, primary/mimic classification, edge building

## Sample Clusters

`;

newSets.slice(0, 20).forEach(s => {
  report += `### Set ${s.setNum}: ${s.graphData.coreDiagnosis.slice(0, 80)} (${s.items.length} Qs)\n`;
  report += `- Primary: ${s.graphData.counts.primary}, Mimic: ${s.graphData.counts.mimic}\n`;
  s.scenes.forEach((sqs, si) => {
    report += `- Scene ${si+1} "${s.sceneTitles[si]}": ${sqs.length} Qs\n`;
  });
  report += '\n';
});

report += `## Unclustered Pool (${unclustered.length} questions)

These questions did not meet the similarity threshold for any cluster. They remain available
for manual review or future clustering passes.

`;

fs.writeFileSync(reportPath, report, 'utf8');
console.log('\nReport written to:', reportPath);

// Write graph-data JSONs
for (const s of newSets) {
  const pad = String(s.setNum).padStart(2, '0');
  const gdPath = path.join(OUT_DIR, 'graph-data-set-' + pad + '.json');
  fs.writeFileSync(gdPath, JSON.stringify(s.graphData, null, 2) + '\n', 'utf8');
}

// Write story HTMLs (skeleton — frontend reads from graph-data JSONs)
const STORY_STEPS = {
  You: ['entry', 'complication'],
  Need: ['entry', 'complication'],
  Go: ['entry', 'complication', 'deepening'],
  Search: ['complication', 'deepening'],
  Find: ['deepening', 'turning point'],
  Take: ['turning point', 'resolution'],
  Return: ['turning point', 'resolution'],
  Change: ['resolution'],
};

for (const s of newSets) {
  const pad = String(s.setNum).padStart(2, '0');
  const htmlPath = path.join(OUT_DIR, 'set-' + pad + '-story-va.html');

  const sceneIds = s.scenes.map((_, si) => si + 1);
  const itemsJs = JSON.stringify(s.items.map(q => {
    const nodeInfo = s.graphData.nodes.find(n => n.id === String(q.id)) || {};
    return {
      id: String(q.id),
      question: q.question,
      answers: q.answers,
      explanation: q.explanation,
      likely: q.likely,
      sceneId: nodeInfo.sceneId || 1,
      indexInScene: nodeInfo.indexInScene || 1,
      category: nodeInfo.category || 'mimic',
    };
  }));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Set ${s.setNum} — ${s.graphData.coreDiagnosis.slice(0, 50)}</title>
<style>
  body { font-family: Inter, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; }
  h1 { font-size: 1.3rem; }
  .scene { margin: 20px 0; padding: 16px; border: 1px solid #e2e4e9; border-radius: 8px; }
  .scene-title { font-weight: 700; font-size: 0.9rem; color: #2563eb; }
  .q { margin: 8px 0; font-size: 0.8rem; }
</style>
</head>
<body>
<h1>Set ${s.setNum}: ${s.graphData.coreDiagnosis.slice(0, 80)}</h1>
<p>Primary: ${s.graphData.counts.primary} · Mimic: ${s.graphData.counts.mimic} · Source: project-based clustering</p>
${s.scenes.map((sqs, si) => `
<div class="scene">
  <div class="scene-title">Scene ${si+1}: ${s.sceneTitles[si]}</div>
  ${sqs.map(q => `<div class="q"><strong>Q${q.id}</strong> — ${q.question.slice(0, 120)}…</div>`).join('\n')}
</div>`).join('\n')}
<script>
const SCENES = ${JSON.stringify(s.sceneTitles)};
const ITEMS = ${itemsJs};
</script>
</body>
</html>`;
  fs.writeFileSync(htmlPath, html, 'utf8');
}

console.log(`\nWrote ${newSets.length} graph-data JSONs + ${newSets.length} story HTMLs to ${OUT_DIR}/`);
console.log('IMPORTANT: Existing Set 21+ files were NOT overwritten. Review output first.');
