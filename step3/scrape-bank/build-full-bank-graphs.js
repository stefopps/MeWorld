#!/usr/bin/env node
/**
 * Builds sets 21–N to cover every remaining unassigned question,
 * generates placeholder story HTMLs + smart-classified graph-data JSONs,
 * and updates concept-graphs.html dropdown.
 */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

// ── Category buckets (broad diagnostic domains for grouping) ──
const BUCKETS = {
  cardio:  ['coronary', 'myocardial', 'heart fail', 'valve', 'arrhythmia', 'atrial fib', 'aortic', 'pericard', 'cardiomyopath', 'cardiac', 'tamponade', 'endocarditis', 'pulmonary embol', 'dvt', 'deep vein', 'hypertension', 'anticoagul', 'warfarin', 'statin', 'beta blocker', 'ace inhibitor', 'angiogram', 'catheter', 'stent', 'cabg', 'bypass', 'syncope', 'chest pain', 'troponin', 'ekg', 'ecg', 'holter', 'echocardiogram'],
  resp:    ['pneumonia', 'copd', 'asthma', 'pulmonary', 'bronchi', 'pleural', 'tuberculosis', 'tb ', 'sarcoid', 'interstitial', 'fibrosis', 'pneumothorax', 'hemothorax', 'empyema', 'bronchiolitis', 'cystic fibros', 'respiratory', 'hypoxia', 'oxygen', 'ventilat', 'intubat'],
  renal:   ['kidney', 'renal', 'nephro', 'dialysis', 'creatinine', 'bun', 'gfr', 'aki', 'ckd', 'glomerul', 'nephri', 'urinary', 'bladder', 'prostate', 'bph', 'urinary tract', 'uti', 'pyelonephritis', 'cystitis', 'stone', 'nephrolith', 'hydronephrosis'],
  gi:      ['hepatitis', 'cirrhosis', 'liver', 'hepatic', 'pancreat', 'gallbladder', 'cholecyst', 'biliary', 'gi bleed', 'hematemesis', 'melena', 'upper gi', 'lower gi', 'colon', 'colorectal', 'diverticul', 'ibd', 'crohn', 'ulcerative colitis', 'peptic ulcer', 'gerd', 'esophageal', 'gastr', 'diarrhea', 'constipat', 'bowel', 'obstruct'],
  heme:    ['anemia', 'hemoglobin', 'hematocrit', 'ferritin', 'iron', 'b12', 'folate', 'sickle', 'thalassemia', 'hemolytic', 'coagul', 'platelet', 'thrombocyt', 'leukemia', 'lymphoma', 'multiple myeloma', 'myelodys', 'neutropenia', 'pancytopenia', 'transfusion', 'blood', 'bleed'],
  endo:    ['diabetes', 'diabetic', 'dka', 'hhs', 'hypoglycem', 'hyperglycem', 'thyroid', 'hypothyroid', 'hyperthyroid', 'graves', 'cushing', 'adrenal', 'addison', 'pituitary', 'prolactin', 'acromegaly', 'hyperparathyroid', 'hypoparathyroid', 'osteoporosis', 'calcium', 'vitamin d', 'hypercalcem', 'hypocalcem'],
  neuro:   ['stroke', 'cva', 'tia', 'seizure', 'epilep', 'migraine', 'headache', 'meningitis', 'encephalitis', 'multiple sclerosis', 'parkinson', 'alzheimer', 'dementia', 'myasthenia', 'guillain', 'neuropath', 'als', 'spinal', 'concussion', 'subdural', 'subarachnoid', 'intracranial', 'brain'],
  psych:   ['depression', 'anxiety', 'bipolar', 'schizophrenia', 'psychosis', 'suicide', 'substance', 'alcohol', 'opioid', 'withdrawal', 'overdose', 'delirium', 'dementia', 'panic', 'ptsd', 'ocd', 'adhd', 'eating disorder', 'anorexia', 'bulimia'],
  id:      ['hiv', 'aids', 'opportunistic', 'cd4', 'tuberculosis', 'tb ', 'malaria', 'dengue', 'lyme', 'syphilis', 'gonorrhea', 'chlamydia', 'herpes', 'hepatitis b', 'hepatitis c', 'influenza', 'covid', 'pneumocystis', 'toxoplasmo', 'cryptococca', 'cmv', 'ebv', 'abscess', 'cellulitis', 'osteomyelit', 'sepsis', 'septic', 'bacteremia', 'meningitis', 'endocarditis', 'fungal', 'parasit', 'helminth'],
  obgyn:   ['pregnan', 'obstetric', 'gynecolog', 'labor', 'delivery', 'postpartum', 'preeclampsia', 'eclampsia', 'ectopic', 'miscarriage', 'abortion', 'fetal', 'amniotic', 'placenta', 'ovarian', 'uterine', 'cervical', 'endometr', 'fibroid', 'menstrual', 'menopause', 'contracept', 'infertility', 'pcos', 'pid', 'pelvic', 'breast', 'mammogram'],
  derm:    ['rash', 'skin', 'dermat', 'eczema', 'psoriasis', 'melanoma', 'basal cell', 'squamous', 'acne', 'urticaria', 'cellulitis', 'abscess', 'wound', 'burn', 'lesion', 'mole', 'nevus'],
  ortho:   ['fracture', 'bone', 'joint', 'arthritis', 'rheumatoid', 'osteoarthrit', 'gout', 'osteoporosis', 'hip', 'knee', 'shoulder', 'spine', 'back pain', 'sciatica', 'disc', 'meniscal', 'acl', 'tendon', 'ligament', 'bursitis', 'tendinitis', 'carpal tunnel'],
  surgery: ['appendicitis', 'cholecyst', 'hernia', 'bowel obstruct', 'perforat', 'volvulus', 'intussuscept', 'post.?op', 'surgical', 'anesthesia', 'wound', 'laparoscop', 'laparotomy'],
  trauma:  ['trauma', 'injury', 'fall', 'motor vehicle', 'accident', 'gunshot', 'stab', 'concussion', 'contusion', 'hematoma', 'shock', 'hemorrhage', 'resuscitation'],
  onc:     ['cancer', 'carcinoma', 'tumor', 'malignan', 'metasta', 'chemotherapy', 'radiation', 'sarcoma', 'adenocarcinoma', 'neoplasm', 'mass', 'palliative', 'hospice'],
  misc:    []  // catch-all
};

function getCategory(text, likelyText) {
  const txt = (text + ' ' + likelyText).toLowerCase();
  for (const [cat, terms] of Object.entries(BUCKETS)) {
    if (cat === 'misc') continue;
    for (const t of terms) {
      if (txt.includes(t)) return cat;
    }
  }
  return 'misc';
}

// ── Load text bank ──
console.log('Loading text-bank.jsonl...');
const lines = fs.readFileSync(path.join(ROOT, 'text-bank.jsonl'), 'utf8').split('\n').filter(Boolean);
const bank = lines.map(l => JSON.parse(l));
console.log(bank.length, 'questions in bank');

// ── Get assigned QIDs ──
const assigned = new Set();
for (let s = 1; s <= 20; s++) {
  const pad = String(s).padStart(2, '0');
  for (const suffix of ['va', 'vb']) {
    const fn = path.join(ROOT, `set-${pad}-story-${suffix}.html`);
    if (!fs.existsSync(fn)) continue;
    const html = fs.readFileSync(fn, 'utf8');
    const start = html.indexOf('const ITEMS = ') + 'const ITEMS = '.length;
    const end = html.lastIndexOf('];', html.indexOf('\nconst SCENES'));
    try {
      const items = JSON.parse(html.slice(start, end + 1));
      items.forEach(q => assigned.add(String(q.id)));
    } catch (e) {}
  }
}
console.log(assigned.size, 'QIDs already assigned');

// ── Filter unassigned ──
const unassigned = bank.filter(q => !assigned.has(String(q.id)));
console.log(unassigned.length, 'unassigned');

// ── Group by category ──
const groups = {};
for (const q of unassigned) {
  const likely = (q.answers || []).find(a => String(a.label || '').replace(/[^a-z]/gi, '').toUpperCase() === String(q.likely || '').replace(/[^a-z]/gi, '').toUpperCase());
  const likelyText = (likely && likely.text ? likely.text : '');
  const cat = getCategory(q.question, likelyText);
  if (!groups[cat]) groups[cat] = [];
  groups[cat].push(q);
}

for (const [cat, qs] of Object.entries(groups)) {
  console.log(`  ${cat}: ${qs.length} Qs`);
}

// ── Build sets (chunk each category, interleave to keep sets diverse) ──
const allChunks = [];
for (const [cat, qs] of Object.entries(groups)) {
  qs.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  for (let i = 0; i < qs.length; i += 40) {
    allChunks.push({ cat, qs: qs.slice(i, i + 40) });
  }
}
// Sort chunks so smaller categories come last (they'll form partial sets)
allChunks.sort((a, b) => b.qs.length - a.qs.length);

// Pad the last chunk if needed
for (let i = 0; i < allChunks.length - 1; i++) {
  while (allChunks[i].qs.length < 40 && allChunks[allChunks.length - 1].qs.length > 0) {
    allChunks[i].qs.push(allChunks[allChunks.length - 1].qs.pop());
  }
}
// Remove empty trailing chunks
for (let i = allChunks.length - 1; i >= 0; i--) {
  if (allChunks[i].qs.length === 0) allChunks.splice(i, 1);
}

console.log(allChunks.length, 'sets to build');

// ── Smart classifier (from build-smart-graphs.js) ──
function likelyText(q) {
  const letter = String(q.likely || '').replace(/[^a-z]/gi, '').toUpperCase();
  const ans = (q.answers || []).find(a => String(a.label || '').replace(/[^a-z]/gi, '').toUpperCase() === letter);
  return (ans && ans.text ? ans.text : '').toLowerCase();
}

function fullText(q) {
  const ans = (q.answers || []).map(a => (a.text || a.label || '')).join(' ');
  return `${q.question} ${ans} ${q.explanation} ${q.likely}`.toLowerCase();
}

function guessCoreDiagnosis(items) {
  // Build bigram frequency from likely answer texts
  const freq = {};
  const stopwords = new Set([
    'the', 'and', 'or', 'of', 'in', 'to', 'a', 'an', 'is', 'be', 'are', 'was', 'were', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might',
    'must', 'can', 'could', 'for', 'from', 'at', 'by', 'on', 'with', 'that', 'this', 'their',
    'your', 'our', 'his', 'her', 'its', '100%', 'not', 'but',
  ]);
  const genericActions = new Set([
    'perform examination', 'discuss options', 'provide reassurance', 'obtain history',
    'physical examination', 'vital signs', 'laboratory studies', 'imaging studies',
    'blood pressure', 'follow up', 'patient education', 'referral specialist',
  ]);

  for (const q of items) {
    const lt = likelyText(q).replace(/\([^)]*\d+[^)]*\)/g, '').trim(); // strip percentages
    const words = lt.split(/[\s,;:]+/).filter(w => w.length > 1);
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = words[i].toLowerCase() + ' ' + words[i+1].toLowerCase();
      // Skip stopword-only or generic action bigrams
      if (stopwords.has(words[i]) && stopwords.has(words[i+1])) continue;
      if (genericActions.has(bigram)) continue;
      if (/^\d/.test(words[i]) || /^\d/.test(words[i+1])) continue;
      freq[bigram] = (freq[bigram] || 0) + 1;
    }
  }

  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 2);
  if (!top.length) return 'Mixed';

  // Title-case and join
  return top.map(([w]) => w.replace(/\b\w/g, c => c.toUpperCase())).join(' · ');
}

function classifyItems(items) {
  // Split into 5 scenes
  const scenes = [[], [], [], [], []];
  for (let i = 0; i < items.length; i++) {
    scenes[i % 5].push(items[i]);
  }
  
  const nodes = [];
  const mainPath = [];
  
  for (const q of items) {
    const lt = likelyText(q);
    const txt = fullText(q);
    
    // primary = the likely answer matches a major diagnostic category
    const majorTerms = ['syndrome', 'disease', 'disorder', 'failure', 'infarction', 'carcinoma', 'cancer', 'thrombosis', 'embolism', 'hemorrhage', 'infection', 'sepsis', 'shock', 'anemia', 'leukemia', 'lymphoma', 'myeloma', 'hepatitis', 'cirrhosis', 'pneumonia', 'tuberculosis', 'stroke', 'seizure', 'meningitis', 'encephalitis', 'renal failure', 'kidney disease', 'diabetes', 'hypothyroidism', 'hyperthyroidism', 'addison', 'cushing', 'osteoporosis', 'fracture'];
    
    const isPrimary = majorTerms.some(t => lt.includes(t));
    
    nodes.push({
      id: String(q.id),
      category: isPrimary ? 'primary' : 'mimic',
      why: isPrimary ? `Core diagnostic fork: ${lt.slice(0, 60)}` : `Differential door in this set`,
    });
    
    if (isPrimary) mainPath.push(String(q.id));
  }
  
  return { nodes, mainPath };
}

function buildEdgesFromNodes(items, nodes) {
  const edges = [];
  // Scene edges
  const inScene = {};
  items.forEach(q => {
    const sid = (items.indexOf(q) % 5) + 1;
    if (!inScene[sid]) inScene[sid] = [];
    inScene[sid].push(q);
  });
  for (const [sid, qs] of Object.entries(inScene)) {
    for (let i = 0; i < qs.length; i++) {
      for (let j = i + 1; j < qs.length; j++) {
        edges.push({ source: String(qs[i].id), target: String(qs[j].id), kind: 'scene' });
      }
    }
  }
  // Thread edges between primary nodes
  const primary = nodes.filter(n => n.category === 'primary');
  for (let i = 0; i < primary.length; i++) {
    for (let j = i + 1; j < primary.length; j++) {
      edges.push({ source: primary[i].id, target: primary[j].id, kind: 'thread', category: 'primary' });
    }
  }
  return edges;
}

function buildSetHtml(setNum, items) {
  const scenes = [[], [], [], [], []];
  items.forEach((q, i) => {
    const sid = (i % 5) + 1;
    const idx = Math.floor(i / 5);
    q.sceneId = sid;
    q.indexInScene = idx + 1;
    scenes[sid - 1].push(q);
  });
  
  const coreDiag = guessCoreDiagnosis(items);
  
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Set ${setNum} · ${coreDiag}</title></head>
<body>
<div class="story-viewer">
<h1>Set ${setNum}: ${coreDiag}</h1>
<div class="scenes"></div>
</div>
<script>
const META = { set: ${setNum}, coreDiagnosis: ${JSON.stringify(coreDiag)}, generated: ${JSON.stringify(new Date().toISOString())} };

const ITEMS = ${JSON.stringify(items, null, 2)};

const SCENES = [
  { id: 1, title: "Entry point", hook: "Initial presentation of ${coreDiag}" },
  { id: 2, title: "Differential 1", hook: "Alternative explanations" },
  { id: 3, title: "Differential 2", hook: "Further workup" },
  { id: 4, title: "Complications", hook: "What could go wrong" },
  { id: 5, title: "Management", hook: "Treatment and follow-up" }
];

const STORY_STEPS = {
  "1": [{ stage: "You", text: "Scene 1 placeholder." }],
  "2": [{ stage: "You", text: "Scene 2 placeholder." }],
  "3": [{ stage: "You", text: "Scene 3 placeholder." }],
  "4": [{ stage: "You", text: "Scene 4 placeholder." }],
  "5": [{ stage: "You", text: "Scene 5 placeholder." }]
};
let si = 0;
</script>
</body>
</html>`;
}

function buildGraphJson(setNum, items, storyFile) {
  const coreDiag = guessCoreDiagnosis(items);
  const { nodes, mainPath } = classifyItems(items);
  const edges = buildEdgesFromNodes(items, nodes);
  
  return {
    set: setNum,
    storyFile,
    source: 'auto-classified: full-bank bulk generator. Master review needed.',
    repo: 'https://github.com/stefopps/MeWorld (step3/scrape-bank)',
    coreDiagnosis: coreDiag,
    recurringThread: '',
    mainPath,
    generatedAt: new Date().toISOString(),
    counts: {
      primary: nodes.filter(n => n.category === 'primary').length,
      mimic: nodes.filter(n => n.category === 'mimic').length,
      thread: 0,
    },
    nodes,
    edges,
  };
}

// ── Generate sets 21–N ──
let setNum = 21;
const newSets = [];

for (let i = 0; i < allChunks.length; i++) {
  const chunk = allChunks[i];
  const items = chunk.qs.map(q => ({ ...q, id: String(q.id) }));
  const sn = setNum;
  const suffix = sn <= 30 ? 'va' : (sn <= 50 ? 'vb' : 'va');
  const pad = String(sn).padStart(2, '0');
  const storyFile = `set-${pad}-story-${suffix}.html`;
  const dataFile = `graph-data-set-${pad}.json`;
  
  // Write story HTML
  const html = buildSetHtml(sn, items);
  fs.writeFileSync(path.join(ROOT, storyFile), html);
  
  // Write graph data
  const graph = buildGraphJson(sn, items, storyFile);
  fs.writeFileSync(path.join(ROOT, dataFile), JSON.stringify(graph, null, 2));
  
  const diag = ((items[0] && items[0].question) || '').replace(/\s+/g, ' ').slice(0, 40);
  console.log(`Set ${sn}: ${items.length} Qs · ${graph.counts.primary}P / ${graph.counts.mimic}M · ${graph.coreDiagnosis}  → ${storyFile} / ${dataFile}`);
  
  newSets.push({ setNum: sn, coreDiagnosis: graph.coreDiagnosis, primary: graph.counts.primary, mimic: graph.counts.mimic, storyFile, dataFile });
  setNum++;
}

// ── Update concept-graphs.html ──
console.log('\nUpdating concept-graphs.html...');
const cgPath = path.join(ROOT, 'concept-graphs.html');
let cgHtml = fs.readFileSync(cgPath, 'utf8');

// Update SET_REGISTRY to include all sets
const registryLines = [];
for (let s = 1; s <= 20; s++) {
  const pad = String(s).padStart(2, '0');
  const suffix = s <= 5 ? 'va' : (s <= 10 ? 'vb' : (s <= 15 ? 'va' : 'vb'));
  registryLines.push(`  ${s}: 'set-${pad}-story-${suffix}.html'`);
}
for (const ns of newSets) {
  registryLines.push(`  ${ns.setNum}: '${ns.storyFile}'`);
}

// Replace the const SET_REGISTRY block
const regStart = cgHtml.indexOf('const SET_REGISTRY = {');
const regEnd = cgHtml.indexOf('};', regStart) + 2;
const newRegistry = 'const SET_REGISTRY = {\n' + registryLines.join(',\n') + '\n}';
cgHtml = cgHtml.slice(0, regStart) + newRegistry + cgHtml.slice(regEnd);

// Update populatePicker to go up to the max set
const maxSet = setNum - 1;
const pickerStart = cgHtml.indexOf('function populatePicker()');
const forLoopOld = cgHtml.indexOf('for (let s = 1; s <=', pickerStart);
const forLoopEnd = cgHtml.indexOf('{', forLoopOld);
cgHtml = cgHtml.slice(0, forLoopOld) + `for (let s = 1; s <= ${maxSet}; s++) ` + cgHtml.slice(forLoopEnd);

// Remove the old hardcoded labels object (20 doesn't reach anymore)
cgHtml = cgHtml.replace(/const labels = \{[\s\S]*?\};/, `// Labels sourced from graph data now`);
// Replace opt.textContent to use coreDiagnosis
cgHtml = cgHtml.replace(
  /opt\.textContent = labels\[s\] \|\| \('Set ' \+ s\)/,
  `opt.textContent = 'Set ' + s + ' · loading...'`
);

// Update the selector's text content after load (add a helper)
cgHtml = cgHtml.replace(
  /sel\.addEventListener\('change'/,
  `// Update picker label after graph loads (handled in loadSet)
  sel.addEventListener('change'`
);

// Add label update in loadSet
cgHtml = cgHtml.replace(
  `document.getElementById('setInfo').textContent =`,
  `// Update dropdown label
  const sel = document.getElementById('setPicker');
  const opt = sel.querySelector('option[value="' + setNum + '"]');
  if (opt) opt.textContent = 'Set ' + setNum + ' · ' + (meta.coreDiagnosis || '—').slice(0, 50);
  document.getElementById('setInfo').textContent =`
);

fs.writeFileSync(cgPath, cgHtml);
console.log('concept-graphs.html updated. Dropdown now supports Sets 1-' + maxSet);

console.log(`\nDone. ${newSets.length} new sets created (${setNum - 21} total). Total sets: 1–${maxSet}`);
