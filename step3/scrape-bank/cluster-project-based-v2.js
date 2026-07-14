// cluster-project-based-v2.js
// Re-clusters the entire question bank (Sets 21+ questions) using project-based/scenario
// clustering. Uses connected-components on a similarity graph + scene-level sub-clustering.
// Does NOT overwrite existing files — output goes to output-recluster/.

const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/steve/MeWorld/step3/scrape-bank';
const OUT_DIR = path.join(ROOT, 'output-recluster');
const TEXT_BANK = JSON.parse(fs.readFileSync(path.join(ROOT, 'text-bank.json'), 'utf8'));

// ── Load Sets 1-20 QIDs (these are untouchable) ──
const SETS_1_20_QIDS = new Set();
for (let i = 1; i <= 20; i++) {
  const pad = String(i).padStart(2, '0');
  const f = path.join(ROOT, 'graph-data-set-' + pad + '.json');
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  (d.nodes || []).forEach(n => SETS_1_20_QIDS.add(String(n.id)));
}
console.log('Sets 1-20 locked Qs:', SETS_1_20_QIDS.size);

const pool = TEXT_BANK.filter(q => !SETS_1_20_QIDS.has(String(q.id)));
console.log('Re-clustering pool:', pool.length, 'questions');

// ── Clinical patterns ──
const CLINICAL_PRESENTATIONS = {
  'chest-pain': ['chest pain','chest discomfort','chest pressure','substernal','retrosternal','crushing chest','angina','chest tightness','chest heaviness'],
  'shortness-of-breath': ['shortness of breath','dyspnea','difficulty breathing','breathlessness','sob','trouble breathing','air hunger','respiratory distress'],
  'abdominal-pain': ['abdominal pain','stomach pain','belly pain','abd pain','epigastric','ruq pain','luq pain','rlq pain','llq pain','periumbilical'],
  'headache': ['headache','head pain','migraine','throbbing head','head pressure'],
  'fever': ['fever','febrile','temperature','temp of','pyrexia','high temperature'],
  'nausea-vomiting': ['nausea','vomiting','emesis','vomited','nauseated'],
  'cough': ['cough','coughing','chronic cough','productive cough','nonproductive','hemoptysis','coughing up blood'],
  'joint-pain': ['joint pain','joint swelling','arthralgia','arthritis','swollen joints','painful joints','stiff joints','morning stiffness'],
  'fatigue': ['fatigue','tiredness','exhaustion','lethargy','malaise','feeling tired','low energy','generalized weakness'],
  'bleeding': ['bleeding','hemorrhage','blood loss','bloody','hematemesis','hematochezia','melena','hemorrhagic'],
  'syncope': ['syncope','fainted','fainting','passed out','loss of consciousness','blackout','collapse'],
  'seizure': ['seizure','convulsion','convulsing','epileptic','jerking'],
  'rash': ['rash','skin lesion','skin eruption','dermatitis','urticaria','hives','eczema','pruritic','pruritus','itchy'],
  'edema': ['edema','swelling','swollen','puffy','anasarca','dependent edema','pitting edema'],
  'confusion': ['confusion','delirium','altered mental status','disorientation','ams','altered mentation'],
  'palpitations': ['palpitations','racing heart','heart racing','pounding heart','irregular heartbeat','skipped beats'],
  'weight-loss': ['weight loss','unintentional weight loss','lost weight','cachexia','wasting'],
  'back-pain': ['back pain','lower back pain','lumbar pain','sciatica','back ache','thoracic pain'],
  'urinary': ['dysuria','hematuria','urinary frequency','polyuria','oliguria','anuria','urinary retention','incontinence','burning urination','flank pain'],
  'gi-bleed': ['gi bleed','gastrointestinal bleed','upper gi bleed','lower gi bleed','rectal bleeding'],
  'trauma': ['trauma','injury','accident','fall','motor vehicle','mva','gunshot','stab wound','assault','blunt trauma','penetrating trauma','fell','hit by','struck'],
};

const BODY_SYSTEMS = {
  'cardio': ['heart','cardiac','coronary','myocardial','aortic','pericardial','ventricular','atrial','valve','valvular','arrhythmia','ecg','ekg','troponin','bnp','angina','infarction','ischemia','cardiomeg','tamponade'],
  'resp': ['lung','pulmonary','bronchial','bronchus','alveol','pleural','respiratory','pneumonia','copd','asthma','fibrosis','pneumothorax','spirometry','fev1','fvc','oxygen','ventilator','intubat','tracheo','sputum'],
  'gi': ['liver','hepatic','hepatitis','cirrhosis','ascites','pancreas','pancreatic','gallbladder','cholecyst','biliary','stomach','gastric','esophageal','esophagus','colon','colonic','colorectal','intestinal','intestine','bowel','appendix','appendic','diverticul','ibd','crohn','ulcerative','peptic','gerd','endoscopy','colonoscopy'],
  'neuro': ['brain','cerebral','intracranial','cerebell','spinal','nerve','neural','neurologic','mening','encephal','seizure','stroke','cva','tia','subarachnoid','subdural','epidural','neuropathy','myelopathy','radiculopathy','dementia','guillain','myasthenia','ct head','mri brain','lumbar puncture','eeg'],
  'renal': ['kidney','renal','nephron','nephro','glomerul','creatinine','bun','gfr','dialysis','hemodialy','urinary','urine','bladder','urethra','ureter','prostate','bph','nephritic','nephrotic','nephrolith','renal stone','hydronephrosis','pyelonephritis','cystitis','uti','proteinuria','hematuria'],
  'heme': ['blood','hematol','hemoglobin','hematocrit','ferritin','iron','folate','b12','anemia','anemic','sickle','thalassemia','hemolysis','hemolytic','coagulation','coagulopathy','clotting','platelet','thrombocyt','thrombosis','thromboemb','dvt','pulmonary embol','embolism','anticoagulant','warfarin','heparin','enoxaparin','transfusion','prbc','ffp'],
  'endo': ['diabetes','diabetic','dka','hhs','insulin','glucose','hyperglycem','hypoglycem','thyroid','tsh','t4','t3','hypothyroid','hyperthyroid','graves','hashimoto','adrenal','cortisol','cushing','addison','pituitary','parathyroid','calcium','pth','osteoporosis','hypercalcem','hypocalcem','hyperkalem','hypokalem'],
  'obgyn': ['pregnan','obstetric','gynecolog','fetal','uterus','uterine','cervical','cervix','ovarian','ovary','endometr','fallopian','vaginal','menstrual','menopause','contracept','pcos','fibroid','leiomyoma','hysterect','placenta','preeclamps','eclamps','ectopic','miscarriage','postpartum','antepartum','fetal heart','amniocentesis','iugr','macrosomia','gdm','gestational diabetes','mastitis','breast','mammogram','lactation'],
  'id': ['infection','infectious','sepsis','septic','bacteremia','bacterial','viral','fungal','antibiotic','antimicrobial','antiviral','hiv','aids','cd4','opportunistic','tuberculosis','tb','malaria','dengue','lyme','syphilis','gonorrhea','chlamydia','abscess','cellulitis','osteomyel','endocarditis','meningitis','encephalitis','culture','gram stain','wbc','leukocytosis','leukopenia','neutropenia','crp','esr','procalcitonin'],
  'onc': ['cancer','carcinoma','tumor','malignan','metasta','metastatic','chemotherap','radiation','sarcoma','adenocarcinoma','neoplasm','lymphoma','leukemia','melanoma','myeloma','palliative','hospice','biopsy','pet scan','staging','tnm','remission','recurrence','screening mammogram','pap smear'],
  'psych': ['depression','depressed','anxiety','anxious','bipolar','mania','schizophrenia','psychosis','psychotic','hallucination','delusion','suicide','suicidal','substance','alcohol','opioid','heroin','cocaine','withdrawal','detox','overdose','intoxication','ptsd','ocd','adhd','anorexia','bulimia','ssri','sertraline','fluoxetine','lithium','antipsychotic'],
  'derm': ['skin','dermat','rash','eczema','psoriasis','acne','urticaria','cellulitis','abscess','wound','burn','lesion','mole','nevus','melanocytic','basal cell','squamous cell','keratosis','dermatoscopy','topical steroid','sunscreen'],
};

const SETTING_WORDS = {
  'emergency': ['emergency department','emergency room','ed','er','emergent','urgent','acute onset','sudden onset','crash','code','rapid response','stat'],
  'pediatric': ['infant','newborn','neonate','toddler','adolescent','pediatric','peds','school-age','nursery','day-old','week-old','month-old'],
};

const STOP_WORDS = new Set(['a','an','the','and','or','but','in','on','at','to','for','of','with','by','from','up','about','into','through','during','before','after','above','below','between','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','shall','should','may','might','must','can','could','this','that','these','those','his','her','its','their','our','your','my','no','not','all','any','both','each','few','more','most','other','some','such','only','own','same','so','than','too','very','just','also','now','then','over','under','again','further','once','here','there','when','where','why','how','which','who','whom']);

const CLINICAL_STOP = new Set(['patient','doctor','physician','hospital','clinic','department','emergency','year','years','old','week','weeks','day','days','month','months','hour','hours','history','presents','present','reports','denies','physical','examination','laboratory','studies','shown','findings','performed','evaluation','management','treatment','diagnosis','diagnostic','appropriate','likely','consistent','positive','negative','normal','abnormal','elevated','decreased','increased','mild','moderate','severe','chronic','acute','symptoms','medications','therapy','follow']);

function extractPresentation(q) {
  const stem = q.question.toLowerCase();
  const words = stem.split(/\s+/).filter(w => !STOP_WORDS.has(w) && !CLINICAL_STOP.has(w));
  const first200 = stem.slice(0, 200);

  const chiefComplaints = [];
  for (const [label, patterns] of Object.entries(CLINICAL_PRESENTATIONS)) {
    for (const p of patterns) {
      if (first200.includes(p)) { chiefComplaints.push(label); break; }
    }
  }

  const systems = [];
  for (const [sys, terms] of Object.entries(BODY_SYSTEMS)) {
    let score = 0;
    for (const t of terms) {
      if (stem.includes(t)) score++;
    }
    if (score >= 2) systems.push(sys);
  }

  const settings = [];
  for (const [s, terms] of Object.entries(SETTING_WORDS)) {
    for (const t of terms) {
      if (first200.includes(t)) { settings.push(s); break; }
    }
  }

  const ageMatch = first200.match(/(\d+)[-\s]year[s]?[-\s]old/);
  const age = ageMatch ? parseInt(ageMatch[1]) : null;
  const isPregnant = first200.includes('pregnan');

  // Extract likely answer text for diagnostic-overlap scoring
  const likelyAnswerText = (q.answers || []).find(a => q.likely && q.likely.startsWith(a.label))?.text?.toLowerCase() || '';

  return {
    id: String(q.id),
    chiefComplaints,
    systems,
    settings,
    age,
    isPregnant,
    likelyAnswerText,
    stemWords: words,
  };
}

// ── Similarity ──
function scenarioSimilarity(a, b) {
  let score = 0;
  for (const cc of a.chiefComplaints) { if (b.chiefComplaints.includes(cc)) score += 5; }
  for (const s of a.systems) { if (b.systems.includes(s)) score += 2; }
  for (const s of a.settings) { if (b.settings.includes(s)) score += 2; }
  if (a.isPregnant && b.isPregnant) score += 3;
  if (a.age && b.age && Math.abs(a.age - b.age) <= 5) score += 1;

  const wa = new Set(a.stemWords);
  const wb = new Set(b.stemWords);
  let shared = 0;
  for (const w of wa) { if (wb.has(w)) shared++; }
  if (shared >= 15) score += 4;
  else if (shared >= 10) score += 2;
  else if (shared >= 5) score += 1;

  // Answer-text overlap = "would a test-taker confuse these?"
  if (a.likelyAnswerText && b.likelyAnswerText) {
    const la = new Set(a.likelyAnswerText.split(/\s+/).filter(w => w.length > 3));
    const lb = new Set(b.likelyAnswerText.split(/\s+/).filter(w => w.length > 3));
    let ansShared = 0;
    for (const w of la) { if (lb.has(w)) ansShared++; }
    if (ansShared >= 3) score += 3;
  }
  return score;
}

// ── Phase: Build fingerprint, bucket, graph, components ──
console.log('Extracting fingerprints...');
const fingerprints = pool.map(q => extractPresentation(q));

// Bucketing to reduce pairwise comparisons
const GRAPH_THRESHOLD = 7;
const SCENE_THRESHOLD = 10;

const buckets = {};
for (const fp of fingerprints) {
  let key = fp.chiefComplaints[0] || fp.systems[0] || 'other';
  if (['chest-pain','shortness-of-breath','palpitations'].includes(key)) key = 'cardio-resp';
  else if (['cough','fever'].includes(key)) key = 'infectious-resp';
  else if (['abdominal-pain','nausea-vomiting','gi-bleed'].includes(key)) key = 'gi';
  else if (['headache','seizure','confusion','syncope'].includes(key)) key = 'neuro';
  else if (['bleeding','fatigue'].includes(key)) key = 'heme';
  else if (['edema','urinary'].includes(key)) key = 'renal-fluid';
  else if (['joint-pain','back-pain','pain-unspecified','trauma'].includes(key)) key = 'msk-trauma';
  else if (['rash'].includes(key)) key = 'derm';
  else if (['weight-loss'].includes(key)) key = 'constitutional';
  else key = 'other';

  if (!buckets[key]) buckets[key] = [];
  buckets[key].push(fp);
}

console.log('Buckets:', Object.keys(buckets).length, '; largest:', Math.max(...Object.values(buckets).map(b=>b.length)));

// Build adjacency
const adjacency = new Map();
for (const fp of fingerprints) adjacency.set(fp.id, []);

let totalCompared = 0;
for (const [bucketKey, bucket] of Object.entries(buckets)) {
  if (bucket.length < 2) continue;
  for (let i = 0; i < bucket.length; i++) {
    for (let j = i + 1; j < bucket.length; j++) {
      totalCompared++;
      const sim = scenarioSimilarity(bucket[i], bucket[j]);
      if (sim >= GRAPH_THRESHOLD) {
        adjacency.get(bucket[i].id).push({ id: bucket[j].id, score: sim });
        adjacency.get(bucket[j].id).push({ id: bucket[i].id, score: sim });
      }
    }
  }
}
const edgeCount = [...adjacency.values()].reduce((s, e) => s + e.length, 0) / 2;
console.log('Comparisons:', totalCompared, '; edges:', edgeCount);

// Connected components (BFS)
const visited = new Set();
const components = [];

for (const fp of fingerprints) {
  if (visited.has(fp.id)) continue;
  const comp = [];
  const queue = [fp.id];
  visited.add(fp.id);

  while (queue.length > 0) {
    const id = queue.shift();
    const item = fingerprints.find(f => f.id === id);
    if (item) comp.push(item);
    for (const { id: neighborId } of (adjacency.get(id) || [])) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }
  components.push(comp);
}

components.sort((a, b) => b.length - a.length);
console.log('Components:', components.length, '; largest:', components.slice(0, 5).map(c => c.length));
console.log('Components >= 5 Qs:', components.filter(c => c.length >= 5).length);

const clusters = components.filter(c => c.length >= 5);
const unclustered = components.filter(c => c.length < 5).flat();
console.log('Usable clusters:', clusters.length);
console.log('Clustered Qs:', clusters.reduce((s, c) => s + c.length, 0));
console.log('Unclustered Qs:', unclustered.length);

// ── Phase 4: Build sets from clusters ──
console.log('\n=== Phase 4: Building sets ===');

let setNum = 21;
const newSets = [];

for (const cluster of clusters) {
  if (cluster.length < 5) continue;

  const items = cluster.map(fp => {
    const q = pool.find(qq => String(qq.id) === fp.id);
    return q ? { ...q, id: String(q.id) } : null;
  }).filter(Boolean);

  if (items.length < 5) continue;

  // Limit to 40 max and 5-scene format
  const setItems = items.slice(0, 40);

  // ── Scene sub-clustering within the set ──
  const itemFps = setItems.map(q => ({ q, fp: fingerprints.find(f => f.id === q.id) })).filter(x => x.fp);
  const sceneItemAssigned = new Set();
  const subGroups = [];

  for (const item of itemFps) {
    if (sceneItemAssigned.has(item.q.id)) continue;
    const group = [item];
    sceneItemAssigned.add(item.q.id);

    for (const other of itemFps) {
      if (sceneItemAssigned.has(other.q.id)) continue;
      if (scenarioSimilarity(item.fp, other.fp) >= SCENE_THRESHOLD) {
        group.push(other);
        sceneItemAssigned.add(other.q.id);
      }
    }
    subGroups.push(group);
  }

  subGroups.sort((a, b) => b.length - a.length);
  const sceneGroups = subGroups.slice(0, 5).filter(g => g.length >= 2);

  if (sceneGroups.length < 2) continue; // Not enough distinct scenes

  const scenes = [];
  for (const sg of sceneGroups) {
    const sceneQs = sg.map(x => x.q).slice(0, 8);
    if (sceneQs.length >= 2) scenes.push(sceneQs);
  }

  if (scenes.length < 2) continue;

  // ── Scene titles ──
  const sceneTitles = sceneGroups.slice(0, scenes.length).map(sg => {
    const ccs = [...new Set(sg.flatMap(x => x.fp.chiefComplaints))].slice(0, 2);
    const sys = [...new Set(sg.flatMap(x => x.fp.systems))].slice(0, 2);
    const parts = [...ccs, ...sys].filter(Boolean);
    return parts.join(' / ') || 'Diagnostic cluster';
  });

  // ── Primary/mimic — highest-feature per scene ──
  const mainPath = [];
  const nodes = [];
  for (let si = 0; si < scenes.length; si++) {
    const sqs = scenes[si];
    const scored = sqs.map(q => {
      const fp = fingerprints.find(f => f.id === q.id);
      return { q, score: (fp ? fp.systems.length * 2 + fp.chiefComplaints.length : 0) };
    }).sort((a, b) => b.score - a.score);

    const primaryCount = Math.min(2, scored.length);
    for (let pi = 0; pi < primaryCount; pi++) {
      scored[pi].q.category = 'primary';
      scored[pi].q.sceneId = si + 1;
      mainPath.push(String(scored[pi].q.id));
      nodes.push({ id: String(scored[pi].q.id), category: 'primary', why: `Core diagnostic fork: scene ${si + 1}` });
    }
    for (let mi = primaryCount; mi < scored.length; mi++) {
      scored[mi].q.category = 'mimic';
      scored[mi].q.sceneId = si + 1;
      nodes.push({ id: String(scored[mi].q.id), category: 'mimic', why: `Differential door in scene ${si + 1}` });
    }
  }

  // ── coreDiagnosis ──
  const allCCs = [...new Set(cluster.flatMap(f => f.chiefComplaints))];
  const allSys = [...new Set(cluster.flatMap(f => f.systems))];
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
  for (let i = 0; i < mainPath.length; i++) {
    for (let j = i + 1; j < mainPath.length; j++) {
      edges.push({ source: mainPath[i], target: mainPath[j], kind: 'thread', category: 'primary' });
    }
  }

  const graphData = {
    set: setNum,
    storyFile: `set-${String(setNum).padStart(2, '0')}-story-va.html`,
    source: 'project-based clustering v2 (connected components + scene sub-clustering)',
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

  newSets.push({ setNum, items: scenes.flat(), graphData, sceneTitles, scenes });
  setNum++;
}

// ── Summary ──
console.log('\n=== SUMMARY ===');
console.log('Total new sets:', newSets.length);
const sizes = newSets.map(s => s.items.length);
if (sizes.length > 0) {
  console.log('Set sizes: min', Math.min(...sizes), 'max', Math.max(...sizes), 'avg', Math.round(sizes.reduce((a,b)=>a+b,0)/sizes.length));
}
console.log('Unclustered pool:', unclustered.length);

console.log('\n=== Sample clusters ===');
newSets.slice(0, 10).forEach(s => {
  console.log(`Set ${s.setNum} (${s.items.length} Qs): ${s.graphData.coreDiagnosis.slice(0, 80)}`);
  s.scenes.forEach((sqs, si) => {
    console.log(`  Scene ${si+1} "${s.sceneTitles[si]}": ${sqs.length} Qs [first: Q${sqs[0]?.id}]`);
  });
});

// ── Write output ──
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const reportPath = path.join(OUT_DIR, 'RECLUSTER_REPORT.md');
let report = `# Project-Based Re-Clustering v2 — Summary Report

> Generated: ${new Date().toISOString()}
> Script: \`cluster-project-based-v2.js\`
> Method: Connected components on similarity graph (threshold ${GRAPH_THRESHOLD}) + scene sub-clustering (threshold ${SCENE_THRESHOLD})
> Backup: \`archive/pre-recluster-backup/20260713-185604/\`

## Overview

| Metric | Value |
|--------|-------|
| Total bank | 4,852 |
| Locked Sets 1-20 | 800 |
| Available pool | 4,052 |
| **New sets produced** | **${newSets.length}** |
| Questions clustered | ${sizes.reduce((a,b)=>a+b,0)} |
| Unclustered pool | ${unclustered.length} |
| Set size range | ${sizes.length ? Math.min(...sizes) + '-' + Math.max(...sizes) : 'N/A'} |
| Avg set size | ${sizes.length ? Math.round(sizes.reduce((a,b)=>a+b,0)/sizes.length) : 'N/A'} |

## Methodology

1. Fingerprint: chief complaint, body systems, clinical setting, shared vocabulary
2. Similarity: weighted sum of shared complaints (+5), systems (+2), settings (+2), word overlap, answer-text overlap (diagnostic confusion check)
3. Bucketed pairwise comparison (by chief-complaint category) to avoid O(N²)
4. Connected components via BFS on the similarity graph
5. Within each component: scene sub-clustering for 2–5 scene groups
6. Primary (spine) nodes: top 1–2 per scene by feature richness

## Sample Clusters

`;

newSets.slice(0, 20).forEach(s => {
  report += `### Set ${s.setNum}: ${s.graphData.coreDiagnosis.slice(0, 80)} (${s.items.length} Qs)\n`;
  report += `- Primary: ${s.graphData.counts.primary}, Mimic: ${s.graphData.counts.mimic}\n`;
  s.scenes.forEach((sqs, si) => {
    report += `- Scene ${si+1} "${s.sceneTitles[si]}" — ${sqs.length} Qs\n`;
  });
  report += '\n';
});

report += `## Unclustered Pool: ${unclustered.length} questions
These questions did not form connected components of ≥ 5 questions at similarity threshold ${GRAPH_THRESHOLD}.

## Remaining cluster list\n`;
newSets.slice(20).forEach(s => {
  report += `- Set ${s.setNum}: ${s.graphData.coreDiagnosis.slice(0, 60)} (${s.items.length} Qs)\n`;
});

fs.writeFileSync(reportPath, report, 'utf8');
console.log('\nReport:', reportPath);

// Write graph-data JSONs and story HTMLs
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
<p>Primary: ${s.graphData.counts.primary} · Mimic: ${s.graphData.counts.mimic} · Source: connected-components clustering</p>
${s.scenes.map((sqs,si) => `<div class="scene"><div class="stitle">Scene ${si+1}: ${s.sceneTitles[si]}</div>${sqs.map(q => `<div class="q"><strong>Q${q.id}</strong> — ${q.question.slice(0,120)}…</div>`).join('\n')}</div>`).join('\n')}
<script>const SCENES=${JSON.stringify(s.sceneTitles)};const ITEMS=${itemsJs};</script></body></html>`;
  fs.writeFileSync(path.join(OUT_DIR, 'set-' + pad + '-story-va.html'), html, 'utf8');
}

console.log(`\nWrote ${newSets.length} sets to ${OUT_DIR}/`);
console.log('Existing Set 21+ files NOT overwritten.');
