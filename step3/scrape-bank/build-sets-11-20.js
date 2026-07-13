#!/usr/bin/env node
/**
 * Draft Sets 11–20 for Avatar Saga v2.
 * Extends the 1–10 batch with 10 new diagnostic-overlap topic chains.
 * Pattern A (11–15) / Pattern B (16–20).  Clones Set 1 scaffold exactly.
 * No invented stems — real QIDs from scrape-bank/raw.
 *
 * Run from scrape-bank folder: node build-sets-11-20.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const RAW = path.join(ROOT, 'raw');
const SET1 = path.join(ROOT, 'set-01-story-va.html');
// Reuse existing extract scaffolding since build-first-10-sets already exports nothing.
// We embed the helpers inline.

// ── bank loader ──────────────────────────────────────────────────────────────
function loadDeduped() {
  const byId = new Map();
  for (const f of fs.readdirSync(RAW).filter((x) => /^scrape-playwright/.test(x))) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8')); }
    catch { continue; }
    for (const p of j.pages || []) {
      const id = String(p.questionId || '').replace(/\D/g, '');
      if (!id || !(p.question || '').trim()) continue;
      const score = (p.hasReveal ? 10 : 0) + (p.explanation || '').length / 100 + (p.answers ? 2 : 0);
      const prev = byId.get(id);
      if (!prev || score > prev._score) {
        byId.set(id, { id, question: p.question || '', answers: p.answers || [],
          explanation: (p.explanation || '').slice(0, 2500), likely: p.likelyCorrectAnswer || '',
          hasReveal: !!p.hasReveal, _score: score, sourceFile: f });
      }
    }
  }
  return [...byId.values()];
}

// ── helpers ───────────────────────────────────────────────────────────────────
function textOf(q) {
  const ans = Array.isArray(q.answers) ? q.answers.map(a => (typeof a === 'string' ? a : a.text || a.label || JSON.stringify(a))).join(' ') : '';
  return `${q.question}\n${ans}\n${q.explanation}`.toLowerCase();
}
function matchScore(t, patterns) { let s = 0; for (const [re, w] of patterns) if (re.test(t)) s += w; return s; }
function normalizeAnswers(answers) {
  if (!Array.isArray(answers)) return [];
  return answers.map((a, i) => ({ label: a.label || String.fromCharCode(65 + i), text: (typeof a === 'string' ? a : a.text || a.label || JSON.stringify(a)) }));
}
function pickForScene(pool, scene, used, want = 8, minScore = 3) {
  const scored = pool.filter(q => !used.has(q.id)).map(q => ({ q, s: matchScore(textOf(q), scene.patterns) }))
    .filter(x => x.s >= minScore).sort((a, b) => b.s - a.s || b.q._score - a.q._score);
  const picks = []; const weak = [];
  for (const { q, s } of scored) {
    if (picks.length >= want) break;
    picks.push({ ...q, sceneScore: s }); used.add(q.id);
    if (s < 5) weak.push({ id: q.id, score: s });
  }
  return { picks, weak, available: scored.length };
}

// ── placeholder prose ────────────────────────────────────────────────────────
function circleStory(scene) {
  const t = scene.title.toLowerCase();
  return [
    { stage: 'You',  text: `Nadia's morning looks ordinary until it doesn't. The chart in front of Dr. Iwu is the quiet version of ${t} — the case that walks in before anyone names the fork. [[1]]` },
    { stage: 'Need', text: `What she wants is a clean answer, not another round of "probably nothing." The cheapest discriminating question that separates this fork's top possibilities. [[2]]` },
    { stage: 'Go',   text: `The threshold is crossed. Someone else walked this same doorway months earlier, same overlap, different outcome — the comparison case that forces him out of the obvious lane. [[3]]` },
    { stage: 'Search', text: `He hunts the wrong turn first, the look-alike that would let everyone go home early. Another chart almost matches until one detail refuses to fit. [[4]]` },
    { stage: 'Find',  text: `What he finds is mechanism, not mood. The finding that separates this fork from its neighbors sits in a lab value, an image, or a single timed clue. [[5]]` },
    { stage: 'Take',  text: `Somewhere else the cost already landed — the patient who paid for this differential being missed. He brings that cost into the room without theatrics. [[6]]` },
    { stage: 'Return', text: `Back to Nadia with the near-miss in hand. A case that looks adjacent but isn't hers — the return that sharpens what hers actually is. [[7]]` },
    { stage: 'Change', text: `By the end of the visit the fork has a name and a next step. The reference case that sticks is the one she will hear again when this shows up on a test. [[8]]` },
  ];
}
function flatStory(scene) {
  return [
    { text: `Nadia and Dr. Iwu stay in the same voice. The first cluster is the ordinary presentation and the cheap discriminator. [[1]] [[2]] [[3]]` },
    { text: `Then the look-alikes: same chief complaint, different mechanism. He walks them in order so the overlap is audible, not decorative. [[4]] [[5]] [[6]]` },
    { text: `What remains is the cost of guessing wrong and the quiet return to what her chart actually needs next. [[7]] [[8]]` },
  ];
}
function buildStorySteps(scenes, pattern) {
  const out = {};
  for (const sc of scenes) out[sc.id] = (pattern === 'A' || sc.id === 1 || sc.id === 5) ? circleStory(sc) : flatStory(sc);
  return out;
}

// ── scaffold extraction from Set 1 ───────────────────────────────────────────
function extractScaffold() {
  const html = fs.readFileSync(SET1, 'utf8');
  const itemsStart = html.indexOf('const ITEMS = ');
  const scenesLine = html.indexOf('\nconst SCENES');
  const head = html.slice(0, itemsStart);
  let tail = html.slice(scenesLine + 1);
  const storyStart = tail.indexOf('const STORY_STEPS = ');
  const storyEnd = tail.indexOf('\nlet si = 0');
  const beforeStory = tail.slice(0, storyStart);
  let afterStory = tail.slice(storyEnd + 1);
  afterStory = afterStory.replace(
    /const storyHTML = steps\.map\(s =>\s*`<div class="story-beat"><span class="stage-tag">\$\{esc\(s\.stage\)}<\/span><p>\$\{chipify\(s\.text\)}<\/p><\/div>`\s*\)\.join\(''\);/,
    `const storyHTML = steps.map(s =>
    s.stage
      ? \`<div class="story-beat"><span class="stage-tag">\${esc(s.stage)}</span><p>\${chipify(s.text)}</p></div>\`
      : \`<div class="story-beat"><p>\${chipify(s.text)}</p></div>\`
  ).join('');`);
  return { head, beforeStory, afterStory };
}

function replaceHeader(head, { setNum, pattern, spine }) {
  const title = `Set ${String(setNum).padStart(2, '0')} — ${spine.split('—')[0].trim()}`;
  const badge = pattern === 'A'
    ? "v2 Pattern A — each scene runs Dan Harmon's Story Circle. One real question per stage."
    : 'v2 Pattern B — full Circle on scenes 1 & 5 only; middle scenes flattened.';
  let h = head;
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  h = h.replace(
    /<header>[\s\S]*?<\/header>/,
    `<header>
    <h1>Set ${String(setNum).padStart(2, '0')} — story first, questions on tap</h1>
    <p><strong>${spine}</strong><br/>
    Avatar demo · Nadia &amp; Dr. Iwu (placeholder) · 5 scenes, 8 real questions each · tap a chip to open the actual bank question</p>
    <span class="badge">${badge}</span>
  </header>`);
  return h;
}

function writeSetHtml({ setNum, pattern, spine, items, storySteps, scaffold }) {
  const fname = `set-${String(setNum).padStart(2, '0')}-story-v${pattern.toLowerCase()}.html`;
  const head = replaceHeader(scaffold.head, { setNum, pattern, spine });
  const storyBlock = `const STORY_STEPS = ${JSON.stringify(storySteps, null, 2)};\n\n`;
  const html = head + `const ITEMS = ${JSON.stringify(items)};\n\n` + scaffold.beforeStory + storyBlock + scaffold.afterStory;
  fs.writeFileSync(path.join(ROOT, fname), html);
  return fname;
}

function loadAllUsedIds() {
  const used = new Set();
  for (let sn = 1; sn <= 10; sn++) {
    const pattern = sn <= 5 ? 'a' : 'b';
    const fname = `set-${String(sn).padStart(2, '0')}-story-v${pattern}.html`;
    const fp = path.join(ROOT, fname);
    if (!fs.existsSync(fp)) continue;
    const html = fs.readFileSync(fp, 'utf8');
    const start = html.indexOf('const ITEMS = ') + 'const ITEMS = '.length;
    const end = html.lastIndexOf('];', html.indexOf('\nconst SCENES'));
    if (end < start) continue;
    const items = JSON.parse(html.slice(start, end + 1));
    items.forEach(q => used.add(String(q.id)));
  }
  return used;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TOPIC CHAINS 11–20  (diagnostic-overlap, not organ dumps)
// ═══════════════════════════════════════════════════════════════════════════════
const CHAINS = [
  // ── Set 11: Diabetes forks ──────────────────────────────────────────────────
  {
    set: 11, pattern: 'A',
    spine: 'Diabetes — DKA vs HHS vs hypoglycemia vs chronic complications',
    scenes: [
      { id: 1, beat: 'entry', title: 'Too much sugar', hook: 'DKA vs HHS: pH, ketones, and osmolality split the fork',
        patterns: [[/diabetic ketoacidosis|dka\b|keton/i,5],[/hyperosmolar|hhs\b/i,5],[/anion gap|metabolic acidosis/i,3],[/beta.?hydroxybutyrate|ketone bodies/i,3],[/hyperglycemi/i,2]] },
      { id: 2, beat: 'complication', title: 'Crash and sugar', hook: 'Hypoglycemia vs insulinoma: Whipple triad and C-peptide',
        patterns: [[/hypoglycemi/i,5],[/insulinoma|whipple/i,5],[/c.?peptide|proinsulin/i,4],[/sulfonylurea|glipizide/i,3],[/octreotide|diazoxide/i,3]] },
      { id: 3, beat: 'deepening', title: 'Feet and eyes', hook: 'Diabetic foot vs Charcot vs osteo: ulcer depth and imaging',
        patterns: [[/diabetic foot|ulcer.*foot|wagner/i,5],[/charcot|neuroarthropathy/i,4],[/osteomyelitis|probe.?to.?bone/i,4],[/peripheral neuropathy|monofilament/i,3],[/amputation|debride/i,3]] },
      { id: 4, beat: 'turning point', title: 'Kidney complications', hook: 'Diabetic nephropathy vs contrast vs other AKI: when the GFR tells the story',
        patterns: [[/diabetic nephropathy|microalbumin/i,5],[/contrast.*nephropathy|aki\b|acute kidney/i,4],[/ace.?i|arb\b|angiotensin/i,3],[/creatinine|gfr\b|estimated glomerular/i,3],[/dialysis|hyperkalemia/i,3]] },
      { id: 5, beat: 'resolution', title: 'Infection and sugar', hook: 'Diabetic infections: mucormycosis vs malignant otitis vs cellulitis vs gas gangrene',
        patterns: [[/mucormyco|rhinocerebral|amphotericin/i,5],[/malignant otitis|pseudomonas.*external/i,4],[/necrotizing fasciitis|gas gangrene|clostrid/i,4],[/cellulitis|diabetic foot infection/i,3],[/insulin|glucose management/i,2]] },
    ],
  },
  // ── Set 12: Acid-Base ──────────────────────────────────────────────────────
  {
    set: 12, pattern: 'A',
    spine: 'Acid-Base — metabolic acidosis vs respiratory vs mixed vs renal tubular',
    scenes: [
      { id: 1, beat: 'entry', title: 'Low pH, low bicarb', hook: 'AG metabolic acidosis: MUDPILES and osmolar gap',
        patterns: [[/metabolic acidosis|anion gap/i,5],[/mudpiles|methanol|ethylene glycol|salicylate|lactate/i,5],[/osmolar gap|osmolal gap/i,4],[/lactic acidosis|ketoacidosis/i,4],[/renal failure.*acidosis/i,3]] },
      { id: 2, beat: 'complication', title: 'Normal gap acid', hook: 'Non-AG metabolic acidosis: diarrhea vs RTA vs acetazolamide',
        patterns: [[/non.?anion gap|hyperchloremic/i,4],[/renal tubular acidosis|rta\b/i,5],[/diarrhea|bicarbonate loss/i,4],[/acetazolamide|carbonic anhydrase/i,3],[/urine anion gap|urine ph/i,3]] },
      { id: 3, beat: 'deepening', title: 'Respiratory drive', hook: 'Acute vs chronic respiratory acidosis/alkalosis: compensation timing',
        patterns: [[/respiratory acidosis|hypercapn/i,5],[/respiratory alkalosis|hyperventil/i,5],[/copd.*retain|hypoventil/i,4],[/pulmonary emboli.*alkal|salicylate.*alkal/i,4],[/compensation|winters/i,3]] },
      { id: 4, beat: 'turning point', title: 'Mixed disorder trap', hook: "Mixed acid-base: when the pH and pCO2 don't agree with the first formula",
        patterns: [[/mixed acid.?base|concurrent.*disorder/i,5],[/pco2\b|bicarbonate|compensation/i,3],[/metabolic acidosis.*alkalosis|multiple.*disorder/i,4],[/salicylate|aspirin overdose/i,3],[/ sepsis|multi.?organ/i,2]] },
      { id: 5, beat: 'resolution', title: 'Electrolyte cascade', hook: 'RTA subtypes vs hyperkalemia vs aldosterone: the distal nephron fork',
        patterns: [[/renal tubular acidosis|rta\b/i,5],[/type [1234].*rta|distal.*rta|proximal.*rta/i,5],[/hyperkalemia|hypokalemia/i,3],[/aldosterone|fludrocortisone|spironolactone/i,4],[/urine (ph|anion gap)/i,3]] },
    ],
  },
  // ── Set 13: Electrolytes ────────────────────────────────────────────────────
  {
    set: 13, pattern: 'A',
    spine: 'Electrolytes — sodium disorders vs potassium vs calcium homeostasis',
    scenes: [
      { id: 1, beat: 'entry', title: 'Too much water, not enough salt', hook: 'Hyponatremia: hypovolemic vs euvolemic vs hypervolemic — UNa first fork',
        patterns: [[/hyponatremia|low sodium/i,5],[/siadh|syndrome of inappropriate/i,5],[/hypovolemic|dehydration/i,3],[/urine sodium|urine osmolal/i,3],[/tolvaptan|demeclocycline/i,3]] },
      { id: 2, beat: 'complication', title: 'Overcorrected', hook: 'Osmotic demyelination vs rapid correction risk',
        patterns: [[/osmotic demyelination|central pontine/i,6],[/rapid correction|hyponatremia.*overcorrect/i,4],[/hypertonic saline|sodium correction/i,3],[/alcohol|malnutrition/i,2],[/mri.*brainstem|pons/i,3]] },
      { id: 3, beat: 'deepening', title: 'Thirst and water balance', hook: 'Hypernatremia: diabetes insipidus (central vs nephrogenic) vs dehydration',
        patterns: [[/hypernatremia|high sodium/i,5],[/diabetes insipidus/i,5],[/central.*di|nephrogenic.*di/i,4],[/desmopressin|ddavp/i,4],[/polyuria|polydipsia/i,3]] },
      { id: 4, beat: 'turning point', title: 'Heart on pause', hook: 'Potassium disorders: hypo vs hyperkalemia ECG and urgency',
        patterns: [[/hyperkalemia|high potassium/i,5],[/hypokalemia|low potassium/i,5],[/ecg.*change|peaked t|u.?wave/i,4],[/calcium gluconate|insulin.*glucose/i,4],[/kayexalate|sodium polystyrene/i,3]] },
      { id: 5, beat: 'resolution', title: 'Bone and beyond', hook: 'Hypercalcemia: malignancy vs hyperparathyroidism vs vitamin D excess',
        patterns: [[/hypercalcemia|high calcium/i,5],[/hyperparathyroid|parathyroid adenoma/i,5],[/malignancy.*hypercalc|pth.?rp/i,4],[/vitamin d.*tox|sarcoid|hydrochlorothiazide/i,4],[/bisphosphonate|calcitonin/i,3]] },
    ],
  },
  // ── Set 14: Stroke ─────────────────────────────────────────────────────────
  {
    set: 14, pattern: 'A',
    spine: 'Stroke — ischemic vs hemorrhagic vs TIA vs mimics (seizure, migraine, hypoglycemia)',
    scenes: [
      { id: 1, beat: 'entry', title: 'One sided weakness, clock ticking', hook: 'Ischemic stroke vs hemorrhagic: CT first, then lytics window',
        patterns: [[/ischemic stroke|cva\b|tia\b/i,5],[/hemorrhagic|intracerebral hemorr|subarachnoid/i,5],[/tpa\b|tissue plasminogen|alteplase/i,4],[/non.?contrast ct|nihss/i,3],[/aphasia|hemiparesis|facial droop/i,2]] },
      { id: 2, beat: 'complication', title: 'Mimics that fool the ED', hook: 'Seizure vs migraine vs hypoglycemia vs conversion: post-ictal and labs',
        patterns: [[/seizure.*postictal|todd.?s paralysis|todd paralysis/i,5],[/hemiplegic migraine|migraine.*weakness/i,4],[/hypoglycemia.*stroke mimic/i,4],[/conversion disorder|functional/i,3],[/eeg|mri?brain/i,2]] },
      { id: 3, beat: 'deepening', title: 'Cardioembolic source', hook: 'AFib vs PFO vs mechanical valve vs endocarditis as stroke sources',
        patterns: [[/atrial fibrillation|paroxysmal a.?fib/i,5],[/patent foramen|pfo\b/i,4],[/endocarditis.*embolic|valve.*emboli/i,4],[/echocardiogram|tee\b| bubble study/i,3],[/anticoagul|warfarin|apixaban|dabigatran/i,3]] },
      { id: 4, beat: 'turning point', title: 'Vertebrobasilar vs carotid', hook: 'Posterior circulation: vertigo, diplopia, dysarthria — different territory same urgency',
        patterns: [[/vertebrobasilar|posterior circulation/i,5],[/basilar artery|vertebral artery|dizziness.*stroke/i,4],[/diplopia|dysarthria|ataxia|locked.?in/i,4],[/carotid|anterior circulation|mca\b|aca\b/i,3],[/thrombectomy|mechanical retrieval/i,3]] },
      { id: 5, beat: 'resolution', title: 'What happens after', hook: 'Stroke workup: carotid imaging, antiplatelet choice, and secondary prevention stat',
        patterns: [[/carotid ultrason|carotid stenosis|carotid endartere/i,5],[/antiplatelet|aspirin|clopidogrel|ticagrelor/i,4],[/statin|atorvastatin|secondary prevention/i,3],[/modified rancin|nihss|agreed upon/i,2],[/rehabilitation|speech therapy|dysphagia/i,2]] },
    ],
  },
  // ── Set 15: Renal AKI ──────────────────────────────────────────────────────
  {
    set: 15, pattern: 'A',
    spine: 'Renal — AKI etiology vs stones vs obstruction vs post-renal vs intrinsic',
    scenes: [
      { id: 1, beat: 'entry', title: 'Creatinine rising', hook: 'AKI: prerenal vs ATN vs AIN — FENa, muddy brown casts, and eosinophils',
        patterns: [[/aki\b|acute kidney/i,5],[/prerenal|fena\b|fractional excretion/i,5],[/acute tubular necrosis|atn\b|muddy brown/i,5],[/acute interstitial nephritis|ain\b|eosinophil/i,4],[/creatinine|bun\b/i,2]] },
      { id: 2, beat: 'complication', title: 'Glomerular crossroads', hook: 'Nephritic vs nephrotic syndrome: sediment, casts, and protein number',
        patterns: [[/nephritic|nephrotic/i,5],[/proteinuria|hematuria|rbc cast/i,4],[/minimal change|membranous|focal segmental/i,4],[/post.?streptococcal|iga nephropathy|goodpasture/i,4],[/biopsy|immunofluorescen/i,3]] },
      { id: 3, beat: 'deepening', title: 'Obstructed outflow', hook: 'BPH vs stone vs retroperitoneal fibrosis vs pelvic mass: when the post-void residual answers',
        patterns: [[/urinary obstruction|hydronephrosis/i,5],[/benign prostatic|bph\b|prostate enlargement/i,4],[/nephrolith|ureteral stone|flank pain/i,4],[/post.?void residual|bladder scan/i,3],[/catheter|stricture|retroperitoneal fibro/i,3]] },
      { id: 4, beat: 'turning point', title: 'Drug harm to the kidney', hook: 'Aminoglycoside vs contrast vs NSAID vs ACEi — four roads to the same creatinine',
        patterns: [[/aminoglycoside|gentamicin|tobramycin/i,5],[/contrast.*nephropathy|radiocontrast/i,4],[/nsaid|ibuprofen|naproxen|indomethacin/i,4],[/ace.?i.*aki|arb.*renal|prerenal.*ace/i,3],[/vancomycin|amphotericin|cisplatin/i,3]] },
      { id: 5, beat: 'resolution', title: 'Who needs dialysis right now', hook: 'Urgent dialysis indications: AEIOU (acidosis, electrolytes, ingestion, overload, uremia)',
        patterns: [[/dialysis|hemodialysis|renal replacement/i,4],[/hyperkalemia.*ecg|cardiac arrest.*potassium/i,4],[/fluid overload.*pulmonary edema|anuria/i,3],[/uremia.*pericarditis|uremic encephalo/i,4],[/metabolic acidosis.*refract/i,3]] },
    ],
  },
  // ── Set 16: GI Bleed (Pattern B) ────────────────────────────────────────────
  {
    set: 16, pattern: 'B',
    spine: 'GI Bleed — upper vs lower vs variceal vs diverticular vs IBD',
    scenes: [
      { id: 1, beat: 'entry', title: 'Blood from above or below', hook: 'Hematemesis vs melena vs hematochezia: BUN/Cr ratio and nasogastric lavage',
        patterns: [[/upper gi bleed|hematemesis|coffee.?ground/i,5],[/melena|hematochezia|lower gi/i,4],[/bun.*creatinine ratio|bun\/cr/i,3],[/nasogastric|lavage|endoscopy/i,3],[/peptic ulcer|gastritis|duodenal/i,3]] },
      { id: 2, beat: 'complication', title: 'Variceal storm', hook: 'Esophageal varices vs gastric varices vs portal hypertensive gastropathy: cirrhosis + bleed',
        patterns: [[/esophageal varices|variceal bleed|banding/i,6],[/cirrhosis|portal hypertension/i,4],[/octreotide|terlipressin|vasopressin/i,4],[/tips\b|transjugular/i,3],[/sengstaken|balloon tamponade/i,3]] },
      { id: 3, beat: 'deepening', title: 'Diverticular vs ischemic vs angiodysplasia', hook: 'Lower GI bleed in older patients: diverticulosis vs ischemic colitis vs AVM',
        patterns: [[/diverticulosis|diverticular bleed/i,5],[/angiodysplasia|arteriovenous malformation|avm\b/i,5],[/ischemic colitis|mesenteric ischemia/i,4],[/colonoscopy.*bleed|ct angio/i,3],[/tagged rbc|nuclear.*scan/i,3]] },
      { id: 4, beat: 'turning point', title: 'Young person with blood', hook: 'IBD (Crohn vs UC) vs infectious colitis vs hemorrhoids as GI bleed sources',
        patterns: [[/crohn|ulcerative colitis|ibd\b/i,5],[/infectious|clostridium|shigella|salmonella|e.?coli/i,4],[/hemorrhoid|anal fissure|rectal/i,3],[/colonoscopy|biopsy|infliximab|mesalamine/i,3],[/steroid|immune.*modulat/i,2]] },
      { id: 5, beat: 'resolution', title: 'Resuscitation and next steps', hook: 'GI bleed management: PPI drip, octreotide, Rockall/Blatchford scoring, and when to scope',
        patterns: [[/ppi\b|pantoprazole|omeprazole|proton pump/i,4],[/rockall|glasgow.?blatchford|risk score/i,4],[/blood transfus|packed rbc|hct\b/i,3],[/endoscopy within|timing.*scope|urgent.*endosc/i,3],[/helicobacter|h\.?pylori/i,3]] },
    ],
  },
  // ── Set 17: Arrhythmias (Pattern B) ────────────────────────────────────────
  {
    set: 17, pattern: 'B',
    spine: 'Arrhythmias — AFib vs flutter vs SVT vs VTach vs heart block',
    scenes: [
      { id: 1, beat: 'entry', title: 'Irregularly irregular', hook: 'AFib vs flutter: rate control vs rhythm control vs anticoagulation — CHADS-VASc first',
        patterns: [[/atrial fibrillation|a.?fib\b/i,6],[/atrial flutter/i,5],[/rate control|rhythm control|cardioversion/i,4],[/chads.?vasc|has.?bled|chads/i,4],[/anticoagul|apixaban|rivaroxaban|warfarin/i,3]] },
      { id: 2, beat: 'complication', title: 'Fast and narrow', hook: 'SVT vs sinus tachycardia vs atrial tachycardia: vagal response and adenosine',
        patterns: [[/supraventricular|svt\b|avnrt|avrt/i,5],[/adenosine|carotid massage|vagal/i,5],[/sinus tachy|appropriate tachy|inappropriate sinus/i,4],[/wpw\b|wolff.?parkinson|delta wave/i,4],[/ablation|electrophys/i,3]] },
      { id: 3, beat: 'deepening', title: 'Wide and fast', hook: 'VTach vs VFib vs SVT with aberrancy vs WPW with AFib: the wide-complex fork',
        patterns: [[/ventricular tachycardia|vtach|vt\b|ventricular fib/i,6],[/wide complex|aberrant|svt.*wide/i,4],[/amiodarone|lidocaine|cpr\b|defibrill/i,4],[/cardioversion|synchron/i,3],[/icd\b|implantable|antiarrhythm/i,2]] },
      { id: 4, beat: 'turning point', title: 'Pause and block', hook: 'Heart block: first vs second (Type I Wenckebach vs Type II Mobitz) vs third degree vs sick sinus',
        patterns: [[/first.?degree|second.?degree|third.?degree|complete heart/i,5],[/wenckebach|mobitz/i,5],[/sick sinus|sinus pause|bradycardia/i,4],[/pacemaker|temporary pacing|atropine/i,4],[/syncope.*block|dizzy.*block/i,3]] },
      { id: 5, beat: 'resolution', title: 'Long-term rhythm decisions', hook: 'Anticoagulation risks vs ablation vs rate/rhythm strategy: shared decision',
        patterns: [[/left atrial appendage|watchman/i,4],[/ablation.*afib|pulmonary vein isol/i,4],[/anticoagulation.*risk|bleeding.*risk/i,3],[/beta.?block|calcium channel|digoxin|diltiazem/i,3],[/holter|event monitor|loop recorder/i,3]] },
    ],
  },
  // ── Set 18: Sepsis/Shock (Pattern B) ────────────────────────────────────────
  {
    set: 18, pattern: 'B',
    spine: 'Sepsis — distributive vs cardiogenic vs hypovolemic vs obstructive shock',
    scenes: [
      { id: 1, beat: 'entry', title: 'Low pressure, warm skin', hook: 'Sepsis vs septic shock: SIRS → qSOFA → lactate — the escalator',
        patterns: [[/sepsis|septic shock|sirs\b/i,6],[/qsofa|sofa score|lactate/i,4],[/vasopressor|norepinephrine|levophed/i,4],[/fluid resuscitat|iv fluid|lactated ringer/i,3],[/source control|antibiotic/i,3]] },
      { id: 2, beat: 'complication', title: 'Pump failure shock', hook: 'Cardiogenic shock vs heart failure vs tamponade: the echo tells the difference',
        patterns: [[/cardiogenic shock|cardiogenic.*shock/i,6],[/tamponade|pulsus|beckenade/i,5],[/ejection fraction|echo.*cardiogenic|bedside echo/i,4],[/dobutamine|inotrope|milrinone/i,4],[/iabc\b|intra.?aortic/i,3]] },
      { id: 3, beat: 'deepening', title: 'Empty tank', hook: 'Hypovolemic vs hemorrhagic shock: when the hematocrit and IVC diameter agree',
        patterns: [[/hypovolemic|volume deple|hemorrhagic shock/i,5],[/bleed|trauma|gi bleed.*shock/i,4],[/ivc.*collapse|caval index/i,4],[/transfusion|massive transfusion|prbc/i,3],[/passive leg raise|fluid responsiveness/i,3]] },
      { id: 4, beat: 'turning point', title: 'Clot in the lung, fluid around the heart', hook: 'PE causing obstructive shock vs tension pneumothorax: asymmetric exam',
        patterns: [[/obstructive shock|pulmonary emboli.*shock|massive pe/i,6],[/tension pneumothorax|needle decomp/i,5],[/tamponade.*shock|pericardial effusion.*shock/i,4],[/thrombolys|tpa.*pe|surgical embolectomy/i,3],[/chest tube|pleural/i,2]] },
      { id: 5, beat: 'resolution', title: 'The distributive mimics', hook: 'Anaphylaxis vs neurogenic vs adrenal crisis as distributive shock sources',
        patterns: [[/anaphylaxis|epinephrine|histamine/i,5],[/neurogenic shock|spinal shock|spinal cord.*shock/i,5],[/adrenal crisis|adrenal insufficiency.*shock|addison/i,5],[/hydrocortisone|stress dose|methylprednisolone/i,3],[/vasopressin|epipen/i,3]] },
    ],
  },
  // ── Set 19: Endocrine pathways (Pattern B) ─────────────────────────────────
  {
    set: 19, pattern: 'B',
    spine: 'Endocrine — adrenal crisis vs pituitary vs Cushing vs hyperaldosteronism',
    scenes: [
      { id: 1, beat: 'entry', title: 'Hypotension unresponsive to fluids', hook: 'Adrenal crisis vs sepsis: the clue in eosinophilia, hyperkalemia, and low cortisol',
        patterns: [[/adrenal crisis|adrenal insufficiency|addison/i,6],[/cortisol|acth stimulation|cosyntropin/i,4],[/hyperkalemia.*low sodium|hypoglycemia.*adrenal/i,3],[/hydrocortisone|fludrocortisone/i,4],[/hypotension.*unresponsive|shock.*adrenal/i,3]] },
      { id: 2, beat: 'complication', title: 'Cushing faces', hook: 'Cushing syndrome vs disease vs ectopic ACTH: dexamethasone suppression to localize',
        patterns: [[/cushing syndrome|cushing.?s disease/i,5],[/dexamethasone suppression/i,5],[/ectopic acth|small.?cell|acth\b/i,4],[/hypercortisol|moon face|striae/i,3],[/pituitary adenoma|mri pituitary/i,3]] },
      { id: 3, beat: 'deepening', title: 'Empty sella, empty hormones', hook: 'Hypopituitarism vs pituitary apoplexy vs Sheehan syndrome: postpartum and sudden headache',
        patterns: [[/hypopituitarism|panhypopituitarism/i,5],[/sheehan|postpartum.*pituitary|pituitary apoplexy/i,5],[/central hypothyroid|central hypogonad|secondary adrenal/i,4],[/mri.*sella|empty sella/i,3],[/hydrocortisone|levothyroxine/i,3]] },
      { id: 4, beat: 'turning point', title: 'Too much aldosterone, too much BP', hook: 'Primary hyperaldosteronism (Conn) vs secondary (RAS) vs Liddle: potassium as discriminator',
        patterns: [[/hyperaldosteron|conn.?s syndrome/i,5],[/renin|renin.?angiotensin|renal artery stenosis/i,4],[/liddle|enac\b|amiloride/i,4],[/hypokalemia.*hypertension/i,3],[/spironolactone|eplerenone/i,3]] },
      { id: 5, beat: 'resolution', title: 'Pheo and paraganglioma', hook: 'Pheochromocytoma vs carcinoid vs mastocytosis: amine excess presenting as panic',
        patterns: [[/pheochromocytoma|paraganglioma|cat urine/i,5],[/metanephrine|vanillylmandelic|vmw\b/i,4],[/alpha.?blocker|phenoxybenzamine|prazosin/i,4],[/paroxysmal hypertension|headache.*sweating.*palpitation/i,3],[/mibg\b|octreotide scan/i,3]] },
    ],
  },
  // ── Set 20: Infectious ID (Pattern B) ──────────────────────────────────────
  {
    set: 20, pattern: 'B',
    spine: 'Infectious disease — HIV complications vs TB vs fungal vs immune reconstitution',
    scenes: [
      { id: 1, beat: 'entry', title: 'CD4 count tells the story', hook: 'HIV opportunistic infections by CD4: PCP (<200) vs CMV (<50) vs toxo vs cryptococcal vs MAC',
        patterns: [[/hiv\b|aids\b|cd4\b|cd4\+? count/i,5],[/pneumocystis|pjp\b|pcp\b|trimethoprim/i,5],[/cmv\b|cytomegalovirus|retinitis/i,4],[/toxoplasm|ring.?enhancing|toxo/i,4],[/cryptococcal|india ink|capsular antigen/i,4]] },
      { id: 2, beat: 'complication', title: 'TB or not TB', hook: 'Active TB vs latent TB: IGRA, CXR, and when rifampin shortens the course',
        patterns: [[/tuberculosis|tb\b|mycobacterium tuberculosis/i,6],[/igra\b|quantiferon|ppd\b|tuberculin/i,4],[/rifampin|isoniazid|rifapentine|directly observed/i,4],[/cavitary|apical|air.?borne/i,3],[/latent tb.*prophylaxis/i,3]] },
      { id: 3, beat: 'deepening', title: 'Fungal deep dives', hook: 'Aspergillus vs Candida vs Histoplasma vs Coccidioides: endemic history and neutropenic risk',
        patterns: [[/aspergill|galactomannan|voriconazole|fungal ball/i,5],[/candida|fluconazole|echinocandin|central line.*candida/i,4],[/histoplasma|blastomyco|coccidio/i,4],[/neutropenia|immunocompromis/i,3],[/amphotericin|itraconazole/i,3]] },
      { id: 4, beat: 'turning point', title: 'Fever of unknown origin', hook: 'FUO: endocarditis vs abscess vs lymphoma vs drug fever vs giant cell arteritis',
        patterns: [[/fever of unknown|fuo\b|prolonged fever/i,5],[/endocarditis|transeophageal|duke criteria/i,4],[/abscess|occult infection/i,3],[/lymphoma.*fever|neoplastic fever/i,4],[/pet.?ct|gallium|labeled wbc/i,3]] },
      { id: 5, beat: 'resolution', title: 'Immune reconstitution', hook: 'IRIS: when starting HAART unmasks TB, MAC, or crypto — treating through the paradox',
        patterns: [[/immune reconstitution|iris\b/i,6],[/art\b|haart|antiretroviral|tenofovir/i,4],[/paradoxical|unmasking tb|unmasking.*infection/i,4],[/corticosteroid.*iris|prednisone.*iris/i,3],[/hiv.*cd4.*improve|cd4 rebound/i,3]] },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
function main() {
  console.log('Loading bank…');
  const pool = loadDeduped();
  console.log('Unique QIDs in bank:', pool.length);

  const used = loadAllUsedIds();
  console.log('Reserved by Sets 1–10:', used.size);

  const scaffold = extractScaffold();
  const manifest = [];

  console.log('\n=== Generating Sets 11–20 ===');
  for (const chain of CHAINS) {
    console.log(`\nSet ${chain.set} (${chain.pattern}) — ${chain.spine}`);
    const sceneResults = [];
    const flags = [];

    for (const sc of chain.scenes) {
      let { picks, weak, available } = pickForScene(pool, sc, used, 8, 3);
      if (picks.length < 8) {
        const more = pickForScene(pool, sc, used, 8 - picks.length, 2);
        picks = picks.concat(more.picks);
        weak = weak.concat(more.weak);
        available += more.available;
        if (picks.length < 8) {
          flags.push(`Scene ${sc.id}: only ${picks.length}/8 — weaker cluster`);
        } else {
          flags.push(`Scene ${sc.id}: filled with lower-confidence matches (minScore 2)`);
        }
      }
      if (weak.length >= 4) {
        flags.push(`Scene ${sc.id}: ${weak.length}/8 picks scored <5`);
      }
      sceneResults.push({
        ...sc,
        questions: picks.map(q => ({
          id: q.id, sceneScore: q.sceneScore, question: q.question,
          answers: normalizeAnswers(q.answers), explanation: q.explanation,
          likely: q.likely, hasReveal: q.hasReveal, sourceFile: q.sourceFile,
        })),
      });
      console.log(`  S${sc.id}: ${picks.length}/8 (top scores ${picks.slice(0,3).map(p=>p.sceneScore).join(',')})`);
    }

    const items = [];
    for (const sc of sceneResults) {
      sc.questions.forEach((q, i) => {
        items.push({
          sceneId: sc.id, sceneBeat: sc.beat, sceneTitle: sc.title, sceneHook: sc.hook,
          indexInScene: i + 1, sceneSize: sc.questions.length, globalIndex: items.length + 1,
          id: q.id, sceneScore: q.sceneScore, question: q.question, answers: q.answers,
          explanation: q.explanation, likely: q.likely, hasReveal: q.hasReveal,
        });
      });
    }

    const storySteps = buildStorySteps(
      sceneResults.map(s => ({ id: s.id, title: s.title, hook: s.hook })),
      chain.pattern,
    );

    const fname = writeSetHtml({
      setNum: chain.set, pattern: chain.pattern, spine: chain.spine,
      items, storySteps, scaffold,
    });

    manifest.push({
      set: chain.set, file: fname, pattern: chain.pattern, spine: chain.spine,
      questionCount: items.length,
      scenes: sceneResults.map(s => ({
        sid: s.id, title: s.title, differential: s.hook,
        count: s.questions.length,
        flagged: s.questions.length < 8 ? `short ${s.questions.length}/8` : null,
      })),
      notes: flags.length ? flags.join('; ') : 'ok',
    });
    console.log(`  Wrote ${fname} — ${items.length} Qs` + (flags.length ? ' ⚠️' : ' ✓'));
  }

  // Write manifest
  let md = `# Sets 11–20 manifest\n\nStatus: DRAFT for Master review. Placeholder avatar = Nadia & Dr. Iwu.\nPattern A (11–15) = full Harmon Circle. Pattern B (16–20) = Circle on 1 & 5 only.\n\n`;
  for (const m of manifest) {
    md += `## Set ${m.set} — Pattern ${m.pattern}\n`;
    md += `- **File:** \`${m.file}\`\n`;
    md += `- **Chain:** ${m.spine}\n`;
    md += `- **Questions:** ${m.questionCount}${m.questionCount < 40 ? ' ⚠️ short' : ''}\n`;
    md += `- **Notes:** ${m.notes}\n`;
    md += `- **Scene differentials:**\n`;
    for (const s of m.scenes) {
      md += `  - Scene ${s.sid} (${s.count}): ${s.differential}${s.flagged ? ` — **${s.flagged}**` : ''}\n`;
    }
    md += '\n';
  }
  fs.writeFileSync(path.join(ROOT, 'sets-11-20-manifest.md'), md);
  fs.writeFileSync(path.join(ROOT, 'sets-11-20-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nWrote sets-11-20-manifest.md');
}

main();
