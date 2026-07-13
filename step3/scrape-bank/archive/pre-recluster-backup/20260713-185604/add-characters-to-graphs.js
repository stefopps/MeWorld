// add-characters-to-graphs.js
// Adds a `character` block (Want/Need/Flaw/Ghost) to all 130 graph-data JSONs.
// Sets 1-20: extracted from story HTMLs where possible
// Sets 21-130: assigned from 10 avatars based on diagnostic domain

const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/steve/MeWorld/step3/scrape-bank';

// ── 10 characters ──────────────────────────────────────────────────────────
const CHARACTERS = {
  Nadia: {
    name: 'Nadia',
    age: 32,
    gender: 'F',
    coreCondition: 'Autoimmune / Rheumatology',
    baseWant: 'to have her pain taken seriously',
    baseNeed: 'to accept that a chronic diagnosis does not mean a broken life',
    baseFlaw: 'minimizes symptoms until crisis hits, then overcorrects with panic',
    baseGhost: 'her mother, dismissed for years as hysterical, diagnosed too late',
    mentor: 'Dr. Iwu',
  },
  Elena: {
    name: 'Elena',
    age: 45,
    gender: 'F',
    coreCondition: 'Endocrine / Metabolic / Reproductive',
    baseWant: 'to know why her body keeps betraying her despite doing everything right',
    baseNeed: 'to see the connections between her conditions instead of treating each as a separate punishment',
    baseFlaw: 'compartmentalizes every health problem — diabetes in one box, cycles in another, never connecting them',
    baseGhost: 'an aunt who died of sugar sickness, unmanaged, and the family never talked about it',
    mentor: 'Dr. Iwu',
    longitudinal: true, // Elena ages across her appearances
  },
  Marcus: {
    name: 'Marcus',
    age: 56,
    gender: 'M',
    coreCondition: 'Cardiology',
    baseWant: 'to prove he is still the strongest man in the room',
    baseNeed: 'to accept limits before his heart makes the decision for him',
    baseFlaw: 'defaults to "I\'m fine" and refuses to rest, even when his chest is tightening',
    baseGhost: 'his father, dead of an MI at 58, collapsed in the garage alone',
    mentor: 'Dr. Iwu',
  },
  James: {
    name: 'James',
    age: 63,
    gender: 'M',
    coreCondition: 'Respiratory',
    baseWant: 'to breathe without thinking about every inhale',
    baseNeed: 'to quit smoking before the next exacerbation is the last',
    baseFlaw: 'rationalizes every cough — allergies, weather, bad sleep — anything but the cigarettes',
    baseGhost: 'his older brother, tethered to an oxygen concentrator, watching TV alone',
    mentor: 'Dr. Iwu',
  },
  Sarah: {
    name: 'Sarah',
    age: 27,
    gender: 'F',
    coreCondition: 'OB/GYN',
    baseWant: 'a healthy baby and to feel like herself again',
    baseNeed: 'to trust her body after it nearly failed her',
    baseFlaw: 'Googles every twinge, loses sleep over rare complications, self-diagnoses catastrophe',
    baseGhost: 'a college roommate who lost a pregnancy at 20 weeks and never talked about it',
    mentor: 'Dr. Iwu',
  },
  David: {
    name: 'David',
    age: 44,
    gender: 'M',
    coreCondition: 'GI / Hepatic',
    baseWant: 'to keep having a drink with dinner like everyone else',
    baseNeed: 'to face the fact that alcohol is destroying his liver, not just relaxing him',
    baseFlaw: 'charm that deflects every direct question — the liver panel is fine, he had a big lunch',
    baseGhost: 'his mother, whose stomach trouble was actually decompensated cirrhosis',
    mentor: 'Dr. Iwu',
  },
  Priya: {
    name: 'Priya',
    age: 34,
    gender: 'F',
    coreCondition: 'Neurology',
    baseWant: 'to finish her dissertation without her brain interrupting her',
    baseNeed: 'to stop intellectualizing symptoms and start treating them as real',
    baseFlaw: 'turns every headache into a differential diagnosis, then dismisses it as interesting but not urgent',
    baseGhost: 'a professor who collapsed mid-lecture from an undiagnosed aneurysm',
    mentor: 'Dr. Iwu',
  },
  Robert: {
    name: 'Robert',
    age: 72,
    gender: 'M',
    coreCondition: 'Renal / Electrolyte',
    baseWant: 'to die at home, not in a hospital bed',
    baseNeed: 'to let his daughter help him before his potassium decides for both of them',
    baseFlaw: 'stubborn independence — hides pills, skips dialysis, lies about fluid intake',
    baseGhost: 'his wife, who died in a hospital six years ago, and he never left the waiting room',
    mentor: 'Dr. Iwu',
  },
  Aisha: {
    name: 'Aisha',
    age: 52,
    gender: 'F',
    coreCondition: 'Oncology',
    baseWant: 'to see her grandchildren grow up',
    baseNeed: 'to walk into the biopsy result instead of waiting for it to find her',
    baseFlaw: 'superstitious avoidance — skips mammograms, ignores lumps, because naming it makes it real',
    baseGhost: 'a cousin who died because the family believed cutting into a tumor spreads it',
    mentor: 'Dr. Iwu',
  },
  Leo: {
    name: 'Leo',
    age: 9,
    gender: 'M',
    coreCondition: 'Pediatrics',
    baseWant: 'to play outside like the other kids without his mom watching from the window',
    baseNeed: 'to understand that his body works differently and that is not his fault',
    baseFlaw: 'hides wheezing and symptoms from adults so he does not get benched again',
    baseGhost: 'the nebulizer mask that haunted his toddler years, the sound of it still wakes him',
    mentor: 'Dr. Iwu',
  },
};

// ── Domain → character mapping (keyword-based, checked against coreDiagnosis + recurringThread + node text) ──
const DOMAIN_MAP = [
  { key: 'Nadia',  words: ['lupus','sle','autoimmune','rheum','scleroderma','vasculitis','raynaud','sjogren','myositis','connective','joint pain','arthritis','gout','psoriatic','ankylosing','fibromyalgia','rheumatology','anemia','hemolytic','hemoglobin','hematocrit','ferritin','iron','b12','folate','sickle','thalassemia','coagul','platelet','thrombocyt','pancytopenia','transfusion','bleed','blood','hemophil'] },
  { key: 'Marcus', words: ['chest pain','acs','angina','mi','myocardial','coronary','cardiac','heart','arrhythmia','atrial fib','afib','svt','vtach','syncope','valve','aortic','pericard','cardiomyopath','tamponade','endocarditis','cardiology'] },
  { key: 'James',  words: ['pneumonia','copd','asthma','bronchi','pleural','pulmonary','respiratory','hypoxia','oxygen','ventilat','intubat','dyspnea','sob','shortness of breath','sarcoid','fibrosis','pneumothorax','empyema','pulmonar'] },
  { key: 'Sarah',  words: ['pregnan','obstetric','gynecolog','labor','delivery','postpartum','preeclamps','eclamps','ectopic','miscarriage','abortion','fetal','amniotic','placenta','ovarian','uterine','cervical','endometr','fibroid','menstrual','menopause','contracept','infertility','pcos','breast','mammogram','pid','pelvic'] },
  { key: 'David',  words: ['hepatitis','cirrhosis','liver','hepatic','pancreat','gallbladder','cholecyst','biliary','gi bleed','hematemesis','melena','colon','colorectal','diverticul','ibd','crohn','peptic ulcer','gerd','esophageal','gastr','bowel','obstruct','jaundice','abdomen'] },
  { key: 'Priya',  words: ['stroke','cva','tia','seizure','epilep','migraine','headache','meningitis','encephalitis','multiple sclerosis','parkinson','alzheimer','dementia','myasthenia','guillain','neuropath','als','spinal','concussion','subdural','subarachnoid','neurology','neurosurg','tremor','ataxia','vertigo','dizziness','aphasia','dysarthria'] },
  { key: 'Robert', words: ['kidney','renal','nephro','dialysis','creatinine','aki','ckd','glomerul','nephri','urinary','bladder','prostate','bph','uti','pyelonephritis','cystitis','stone','nephrolith','electrolyte','sodium level','potassium level','calcium leve','acid-base','rta','hypernatrem','hyponatrem','hyperkalem','hypokalem','hypercalcem','hypocalcem'] },
  { key: 'Aisha',  words: ['cancer','carcinoma','tumor','malignan','metasta','chemotherap','radiation','sarcoma','adenocarcinoma','neoplasm','palliative','hospice','oncology','lymphoma','leukemia','melanoma','mass ','biopsy','screening','mammogram'] },
  { key: 'Elena',  words: ['diabetes','diabetic','dka','hhs','hypoglycem','hyperglycem','thyroid','hypothyroid','hyperthyroid','graves','cushing','adrenal','addison','pituitary','acromegaly','osteoporosis','endocrin','hysteroscop','myomectom','estrogen','progestin','insulin','glucose','metabol'] },
  { key: 'Leo',    words: ['pediatric','child','infant','newborn','neonat','adolescent','vaccin','growth','milestone','developmental','febrile','congenital','cow milk','milk protein','pediatrics','nursery','toddler','school-age','immunization','breastfeeding','childhood'] },
];

const FALLBACK = 'Nadia'; // when no strong match

function matchCharacter(data) {
  const base = [
    (data.meta?.coreDiagnosis || data.coreDiagnosis || ''),
    (data.meta?.recurringThread || data.recurringThread || ''),
  ].join(' ').toLowerCase();

  // Also check a sample of node whys
  let extraText = '';
  if (data.nodes) {
    extraText = data.nodes.slice(0, 10).map(n => (n.why || '').toLowerCase()).join(' ');
  }
  const haystack = base + ' ' + extraText;

  let best = FALLBACK;
  let bestScore = 0;
  const scores = {};
  for (const { key, words } of DOMAIN_MAP) {
    let score = 0;
    for (const w of words) {
      if (haystack.includes(w)) score += 1;
    }
    scores[key] = score;
    if (score > bestScore) { bestScore = score; best = key; }
  }
  return { key: best, score: bestScore, scores };
}

// ── For sets 1-20: extract from story HTML ──────────────────────────────────
function extractFromStory(setNum) {
  const pad = String(setNum).padStart(2, '0');
  const dir = fs.readdirSync(ROOT).find(f => f.startsWith(`set-${pad}-story-`));
  if (!dir) return null;
  const html = fs.readFileSync(path.join(ROOT, dir), 'utf8');

  // Try to find ITEMS array with stage data
  const itemsMatch = html.match(/const ITEMS\s*=\s*(\[[\s\S]*?\]);/);
  if (!itemsMatch) return null;

  let items;
  try { items = Function('return (' + itemsMatch[1] + ')')(); } catch (_) { return null; }

  // Extract story stages
  const stages = {};
  for (const item of items) {
    if (item.stage) stages[item.stage.toLowerCase()] = item.text?.slice(0, 200) || '';
  }

  // Read <title> for diagnosis hint
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(/Set \d+ — /, '') : '';

  // Determine likely character from context
  const allText = items.map(i => i.text || '').join(' ').toLowerCase();
  const { key: charKey } = matchCharacter({ coreDiagnosis: title, nodes: items.map(i => ({ why: i.text?.slice(0, 50) || '' })) });

  return { charKey, stages, title };
}

// ── Generate set-specific Want/Need ────────────────────────────────────────
function makeSetProfile(char, setNum, data) {
  const ch = CHARACTERS[char];
  if (!ch) return null;

  const coreDiag = data.meta?.coreDiagnosis || data.coreDiagnosis || '';
  const domain = coreDiag.replace(/·/g, '/').replace(/\s+/g, ' ').trim().slice(0, 60);

  // Age progression for longitudinal characters
  let age = ch.age;
  if (ch.longitudinal && setNum > 20) {
    const extra = Math.floor((setNum - 20) / 15);
    age = ch.age + extra;
  } else if (ch.longitudinal && setNum >= 11 && setNum <= 15) {
    age = ch.age; // diabetes arc
  } else if (ch.longitudinal && setNum >= 40 && setNum <= 55) {
    age = ch.age + 3; // PCOS/reproductive arc
  } else if (ch.longitudinal && setNum >= 70 && setNum <= 85) {
    age = ch.age + 5; // absent uterus/anatomical arc
  }

  // Domain-specific Want/Need
  const want = `to understand what ${domain.toLowerCase()} means for their life — not just the lab values`;
  const need = `to integrate this diagnosis with their existing health without letting each new finding become a separate identity`;

  return {
    name: ch.name,
    age,
    gender: ch.gender,
    want: ch.baseWant,
    need: ch.baseNeed,
    flaw: ch.baseFlaw,
    ghost: ch.baseGhost,
    mentor: ch.mentor,
    domain,
    domainWant: want,
    domainNeed: need,
  };
}

// ── Set-specific overrides for Elena's longitudinal arc ────────────────────
const ELENA_OVERRIDES = {
  // Diabetes arc (sets 11-15ish, any set with diabetes keywords)
  diabetes: {
    age: 45,
    want: 'to understand why she is always thirsty and exhausted despite doing everything right',
    need: 'to accept that her body needs insulin, not willpower — and that needing help is not failure',
  },
  // PCOS/reproductive arc
  reproductive: {
    age: 48,
    want: 'to know why she cannot get pregnant when she is finally ready, after years of being told to focus on her sugars first',
    need: 'to see that her metabolic syndrome and her reproductive system are the same story, not competing ones',
  },
  // Absent uterus / anatomical findings
  anatomical: {
    age: 50,
    want: 'to understand the imaging report that says uterus not visualized and what that means for a woman who still feels whole',
    need: 'to reconcile her identity with an anatomical finding that does not define her',
  },
};

function applyElenaOverride(ch, data) {
  const haystack = [
    (data.meta?.coreDiagnosis || data.coreDiagnosis || ''),
    (data.meta?.recurringThread || data.recurringThread || ''),
  ].join(' ').toLowerCase();

  if (/pcos|pregnant|infertile|reproductive|ovarian|uterine|endometr|menstrual|menopause|contracept|hysteroscop|myomectom|estrogen|progestin/.test(haystack)) {
    return { ...ch, ...ELENA_OVERRIDES.reproductive };
  }
  if (/absent|not visualized|anatomical|mullerian|agenesis|uterine anomaly|unicornuate|bicornuate|septate|rudimentary/.test(haystack)) {
    return { ...ch, ...ELENA_OVERRIDES.anatomical };
  }
  // Default: diabetes profile (her primary arc)
  return { ...ch, ...ELENA_OVERRIDES.diabetes };
}

// ── MAIN ───────────────────────────────────────────────────────────────────
console.log('=== add-characters-to-graphs.js ===\n');

const files = fs.readdirSync(ROOT)
  .filter(f => /^graph-data-set-(\d+)\.json$/.test(f))
  .sort((a, b) => {
    const na = parseInt(a.match(/\d+/)[0]);
    const nb = parseInt(b.match(/\d+/)[0]);
    return na - nb;
  });

let updated = 0;
let fromStory = 0;
let fromDomain = 0;
let fromRoundRobin = 0;

// Track character assignments for balanced distribution
const charCounts = Object.fromEntries(Object.keys(CHARACTERS).map(k => [k, 0]));
const ALL_CHARS = Object.keys(CHARACTERS);

for (const file of files) {
  const setNum = parseInt(file.match(/\d+/)[0]);
  const filepath = path.join(ROOT, file);
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

  let charKey = null;

  // Sets 1-20: try to extract from story HTML
  if (setNum <= 20) {
    const extracted = extractFromStory(setNum);
    if (extracted && extracted.charKey) {
      charKey = extracted.charKey;
      fromStory++;
    }
  }

  // Fallback: domain match with balanced round-robin for weak matches
  if (!charKey) {
    const match = matchCharacter(data);
    if (match.score >= 3) {
      // Strong match — use it
      charKey = match.key;
      fromDomain++;
    } else {
      // Weak match — assign to least-used character
      const minCount = Math.min(...Object.values(charCounts));
      const candidates = ALL_CHARS.filter(k => charCounts[k] === minCount);
      // Among least-used, pick the one with the best domain score
      candidates.sort((a, b) => (match.scores[b] || 0) - (match.scores[a] || 0));
      charKey = candidates[0];
      fromRoundRobin++;
    }
  }

  charCounts[charKey] = (charCounts[charKey] || 0) + 1;

  // Build character block
  let ch = makeSetProfile(charKey, setNum, data);
  if (!ch) ch = makeSetProfile(FALLBACK, setNum, data);

  // Apply Elena overrides for her longitudinal arc
  if (ch.name === 'Elena') {
    ch = applyElenaOverride(ch, data);
  }

  // Store in graph data
  data.character = ch;
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  updated++;

  if (setNum <= 5 || setNum >= 125 || setNum % 20 === 0) {
    console.log(`Set ${setNum}: ${ch.name} (${ch.age}${ch.gender}) — ${ch.domain.slice(0, 50)} [${setNum <= 20 ? 'story' : 'domain'}]`);
  }
}

console.log(`\nDone. ${updated} sets updated.`);
console.log(`  From story HTMLs: ${fromStory}`);
console.log(`  From strong domain match:  ${fromDomain}`);
console.log(`  From balanced round-robin: ${fromRoundRobin}`);
console.log(`\nCharacter distribution:`);

// Count distribution
const dist = {};
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const name = data.character?.name || 'unknown';
  dist[name] = (dist[name] || 0) + 1;
}
for (const [name, count] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name}: ${count} sets`);
}
