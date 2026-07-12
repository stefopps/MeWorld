#!/usr/bin/env node
/**
 * Draft Sets 1–10 for Avatar Saga v2.
 * Set 1 = existing set-01-story-va.html (kept as-is).
 * Sets 2–10 mined from scrape-bank/raw; Pattern A (2–5) / Pattern B (6–10).
 * No invented stems — real QIDs only.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const RAW = path.join(ROOT, 'raw');
const SET1 = path.join(ROOT, 'set-01-story-va.html');
const META1 = path.join(ROOT, '_set1-meta.json');

const STAGES = ['You', 'Need', 'Go', 'Search', 'Find', 'Take', 'Return', 'Change'];

function loadDeduped() {
  const byId = new Map();
  for (const f of fs.readdirSync(RAW).filter((x) => /^scrape-playwright/.test(x))) {
    let j;
    try {
      j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
    } catch {
      continue;
    }
    for (const p of j.pages || []) {
      const id = String(p.questionId || '').replace(/\D/g, '');
      if (!id || !(p.question || '').trim()) continue;
      const score =
        (p.hasReveal ? 10 : 0) +
        (p.explanation || '').length / 100 +
        (p.answers ? 2 : 0);
      const prev = byId.get(id);
      if (!prev || score > prev._score) {
        byId.set(id, {
          id,
          question: p.question || '',
          answers: p.answers || [],
          explanation: (p.explanation || '').slice(0, 2500),
          likely: p.likelyCorrectAnswer || '',
          hasReveal: !!p.hasReveal,
          _score: score,
          sourceFile: f,
        });
      }
    }
  }
  return [...byId.values()];
}

function textOf(q) {
  const ans = Array.isArray(q.answers)
    ? q.answers
        .map((a) => (typeof a === 'string' ? a : a.text || a.label || JSON.stringify(a)))
        .join(' ')
    : '';
  return `${q.question}\n${ans}\n${q.explanation}`.toLowerCase();
}

function matchScore(t, patterns) {
  let s = 0;
  for (const [re, w] of patterns) {
    if (re.test(t)) s += w;
  }
  return s;
}

function normalizeAnswers(answers) {
  if (!Array.isArray(answers)) return [];
  return answers.map((a, i) => {
    if (typeof a === 'string') return { label: String.fromCharCode(65 + i), text: a };
    return {
      label: a.label || String.fromCharCode(65 + i),
      text: a.text || a.label || JSON.stringify(a),
    };
  });
}

function pickForScene(pool, scene, used, want = 8, minScore = 3) {
  const scored = pool
    .filter((q) => !used.has(q.id))
    .map((q) => ({ q, s: matchScore(textOf(q), scene.patterns) }))
    .filter((x) => x.s >= minScore)
    .sort((a, b) => b.s - a.s || b.q._score - a.q._score);

  const picks = [];
  const weak = [];
  for (const { q, s } of scored) {
    if (picks.length >= want) break;
    picks.push({ ...q, sceneScore: s });
    used.add(q.id);
    if (s < 5) weak.push({ id: q.id, score: s });
  }
  return { picks, weak, available: scored.length };
}

/** Placeholder Nadia / Dr. Iwu prose — same voice across all sets. */
function circleStory(scene) {
  const h = scene.hook;
  const t = scene.title;
  return [
    {
      stage: 'You',
      text: `Nadia's morning looks ordinary until it doesn't. The chart in front of Dr. Iwu is the
quiet version of ${t.toLowerCase()} — the case that walks in before anyone names the fork. [[1]]`,
    },
    {
      stage: 'Need',
      text: `What she wants is a clean answer, not another round of "probably nothing." He starts
with the cheapest discriminating question that could make ${h.split(':')[0].toLowerCase()} real or
dismissible. [[2]]`,
    },
    {
      stage: 'Go',
      text: `The threshold is crossed. Someone else walked this same doorway months earlier, same
overlap, different outcome — the comparison case that forces him out of the obvious lane. [[3]]`,
    },
    {
      stage: 'Search',
      text: `He hunts the wrong turn first, the look-alike that would let everyone go home early.
Another chart almost matches until one detail refuses to fit. [[4]]`,
    },
    {
      stage: 'Find',
      text: `What he finds is mechanism, not mood. The finding that separates this fork from its
neighbors sits in a lab value, an image, or a single timed clue. [[5]]`,
    },
    {
      stage: 'Take',
      text: `Somewhere else the cost already landed — the patient who paid for this differential
being missed. He brings that cost into the room without theatrics. [[6]]`,
    },
    {
      stage: 'Return',
      text: `Back to Nadia with the near-miss in hand. A case that looks adjacent but isn't hers —
the return that sharpens what hers actually is. [[7]]`,
    },
    {
      stage: 'Change',
      text: `By the end of the visit the fork has a name and a next step. The reference case that
sticks is the one she will hear again when this shows up on a test. [[8]]`,
    },
  ];
}

function flatStory(scene) {
  return [
    {
      text: `Nadia and Dr. Iwu stay in the same voice as always — no stage tags here, just the
comparison cases that sit next to ${scene.title.toLowerCase()}. The first cluster is the ordinary
presentation and the cheap discriminator. [[1]] [[2]] [[3]]`,
    },
    {
      text: `Then the look-alikes: same chief complaint, different mechanism. He walks them in order
so the overlap is audible, not decorative. [[4]] [[5]] [[6]]`,
    },
    {
      text: `What remains is the cost of guessing wrong and the quiet return to what her chart
actually needs next. [[7]] [[8]]`,
    },
  ];
}

function buildStorySteps(scenes, pattern) {
  const out = {};
  for (const sc of scenes) {
    const full = pattern === 'A' || sc.id === 1 || sc.id === 5;
    out[sc.id] = full ? circleStory(sc) : flatStory(sc);
  }
  return out;
}

/**
 * Topic chains: diagnostic-overlap forks (not organ dumps).
 * sceneHook = one-sentence differential rationale (per instructions).
 */
const CHAINS = [
  {
    set: 2,
    pattern: 'A',
    spine: 'Chest pain — ACS vs PE vs dissection vs pericarditis vs GERD',
    scenes: [
      {
        id: 1,
        beat: 'entry',
        title: 'Pressure in the chest',
        hook: 'ACS vs PE vs dissection: same pressure, different clocks and risks',
        patterns: [
          [/chest pain|substernal|pressure|tightness/i, 3],
          [/myocardial|acs\b|nstemi|stemi|unstable angina|troponin/i, 5],
          [/pulmonary emboli|pe\b|d-?dimer|wells/i, 4],
          [/dissection|tearing|unequal (bp|blood pressure)|marfan/i, 5],
          [/pericardit|pleuritic|leaning forward/i, 3],
        ],
      },
      {
        id: 2,
        beat: 'complication',
        title: 'Clot in the lung fork',
        hook: 'PE vs pneumonia vs infarct: hypoxia and pain without a clean coronary story',
        patterns: [
          [/pulmonary emboli|pe\b|v\/q|ct.?pa|right heart/i, 5],
          [/deep vein|dvt\b|leg swelling|immobili/i, 4],
          [/hypox|tachypnea|pleuritic/i, 3],
          [/pneumonia|infiltrate|fever/i, 2],
          [/anticoagul/i, 2],
        ],
      },
      {
        id: 3,
        beat: 'deepening',
        title: 'Tear vs plaque',
        hook: 'Aortic dissection vs ACS: tearing pain, pulse deficits, and who gets cath vs CT',
        patterns: [
          [/aortic dissection|dissecting/i, 6],
          [/tearing|ripping|interscapular/i, 4],
          [/unequal|pulse deficit|widened mediastinum/i, 4],
          [/type a|type b|ascending aorta/i, 3],
          [/cocaine|hypertensive emergency/i, 2],
        ],
      },
      {
        id: 4,
        beat: 'turning point',
        title: 'Rub and relief',
        hook: 'Pericarditis vs MI vs myocarditis: positional pain, ECG stages, troponin traps',
        patterns: [
          [/pericardit/i, 6],
          [/friction rub|leaning forward|positional/i, 4],
          [/diffuse st|pr depression|electrical alternans/i, 4],
          [/myocardit|troponin/i, 3],
          [/tamponade|pulsus|beckks/i, 3],
        ],
      },
      {
        id: 5,
        beat: 'resolution',
        title: 'Burn vs ischemia',
        hook: 'GERD/esophageal spasm vs cardiac: when antacids win and when they must not',
        patterns: [
          [/gerd|reflux|heartburn|esophag/i, 5],
          [/antacid|ppi\b|omeprazole/i, 3],
          [/chest pain|epigastric/i, 2],
          [/rule out|cardiac|stress test/i, 2],
          [/nutcracker|spasm|motility/i, 3],
        ],
      },
    ],
  },
  {
    set: 3,
    pattern: 'A',
    spine: 'Syncope — reflex vs orthostatic vs cardiac vs seizure mimic',
    scenes: [
      {
        id: 1,
        beat: 'entry',
        title: 'Brief loss, crowded room',
        hook: 'Vasovagal vs cardiac syncope: prodrome, triggers, and red-flag hearts',
        patterns: [
          [/syncope|faint|passed out|loss of consciousness/i, 5],
          [/vasovagal|neurocardiogenic|situational/i, 4],
          [/prodrome|nausea|diaphoresis|warmth/i, 3],
          [/arrhythmia|vt\b|long qt|brugada|sick sinus/i, 4],
          [/orthostatic|volume deple/i, 3],
        ],
      },
      {
        id: 2,
        beat: 'complication',
        title: 'Standing up wrong',
        hook: 'Orthostatic hypotension vs autonomic failure vs meds: the standing BP story',
        patterns: [
          [/orthostatic/i, 6],
          [/volume|dehydrat|hemorrhage|bleed/i, 3],
          [/autonomic|parkison|diabetic autonomic/i, 4],
          [/alpha.?block|diuretic|antihypertensive/i, 3],
          [/tilt.?table/i, 3],
        ],
      },
      {
        id: 3,
        beat: 'deepening',
        title: 'Heart pauses the room',
        hook: 'Arrhythmic syncope vs structural: no warning, injury, abnormal ECG',
        patterns: [
          [/syncope/i, 3],
          [/complete heart block|av block|sick sinus|pause/i, 5],
          [/ventricular tachycardia|torsades|long qt/i, 5],
          [/aortic stenosis|hocm|hypertrophic/i, 4],
          [/implantable|pacemaker|icd\b/i, 3],
        ],
      },
      {
        id: 4,
        beat: 'turning point',
        title: 'Shake or faint',
        hook: 'Seizure vs syncope: tongue bite, post-ictal state, and incontinence traps',
        patterns: [
          [/seizure|epilep|convuls/i, 5],
          [/postictal|tongue bite|incontin/i, 4],
          [/syncope|convulsive syncope/i, 3],
          [/eeg\b|antiepileptic/i, 3],
          [/hypoglycemia|alcohol withdraw/i, 2],
        ],
      },
      {
        id: 5,
        beat: 'resolution',
        title: 'Who needs admission',
        hook: 'Risk stratify: San Francisco / Canadian rules vs discharge with follow-up',
        patterns: [
          [/syncope/i, 3],
          [/admission|observ|telemetry/i, 3],
          [/risk|san francisco|canadian|chads/i, 3],
          [/ecg|electrocardiogram/i, 2],
          [/next step|most appropriate/i, 2],
          [/carotid sinus|driver|restriction/i, 3],
        ],
      },
    ],
  },
  {
    set: 4,
    pattern: 'A',
    spine: 'Anemia — iron vs B12/folate vs hemolysis vs marrow vs AOCD',
    scenes: [
      {
        id: 1,
        beat: 'entry',
        title: 'Tired blood, small cells',
        hook: 'Iron deficiency vs thalassemia vs AOCD: MCV, ferritin, and RDW forks',
        patterns: [
          [/anemia|hemoglobin|hematocrit/i, 3],
          [/iron deficiency|ferritin|microcytic/i, 5],
          [/thalassemia|mentzer/i, 4],
          [/anemia of chronic|ao[ci]d|inflammation/i, 4],
          [/mcv|rdw|hypochrom/i, 2],
        ],
      },
      {
        id: 2,
        beat: 'complication',
        title: 'Big cells, numb feet',
        hook: 'B12 vs folate vs drug marrow: neurologic findings tip the scale',
        patterns: [
          [/b12|cobalamin|pernicious|intrinsic factor/i, 5],
          [/folate|folic/i, 4],
          [/macrocytic|megaloblastic|hypersegment/i, 4],
          [/neuropathy|posterior column|vibration/i, 3],
          [/methotrexate|hydroxyurea/i, 2],
        ],
      },
      {
        id: 3,
        beat: 'deepening',
        title: 'Breaking too fast',
        hook: 'Hemolysis vs bleed: LDH, haptoglobin, bilirubin, and smear clues',
        patterns: [
          [/hemoly|haptoglobin|ldh\b|indirect bilirubin/i, 5],
          [/schistocyte|maha|dic\b|ttp\b|hus\b/i, 5],
          [/spherocyte|g6pd|sickle|autoimmune hemolytic/i, 4],
          [/reticulocyte/i, 3],
          [/transfusion|coombs/i, 2],
        ],
      },
      {
        id: 4,
        beat: 'turning point',
        title: 'Marrow quiet',
        hook: 'Aplastic vs infiltration vs pure red cell: pancytopenia differentials',
        patterns: [
          [/aplastic|pancytopen|bone marrow/i, 5],
          [/leukemia|myelodysplas|infiltrat/i, 4],
          [/pure red cell|parvovirus/i, 4],
          [/neutropenia|thrombocytopenia/i, 2],
          [/chemotherapy|radiation/i, 2],
        ],
      },
      {
        id: 5,
        beat: 'resolution',
        title: 'Find the leak',
        hook: 'GI occult blood vs menorrhagia vs hookworm: where the iron went',
        patterns: [
          [/occult|guaiac|colonoscop|endoscop/i, 4],
          [/menorrhagia|heavy menses|fibroid/i, 4],
          [/iron|ferrous|replacement/i, 3],
          [/celiac|hookworm|malabsor/i, 3],
          [/anemia/i, 2],
        ],
      },
    ],
  },
  {
    set: 5,
    pattern: 'A',
    spine: 'Thyroid — Graves vs toxic nodule vs thyroiditis vs hypo traps',
    scenes: [
      {
        id: 1,
        beat: 'entry',
        title: 'Hot and shaky',
        hook: 'Graves vs toxic nodule vs factitious: uptake scan separates them',
        patterns: [
          [/hyperthyroid|thyrotoxic|graves/i, 5],
          [/exophthalmos|orbitopathy|pretibial/i, 4],
          [/radioactive iodine|uptake|scan/i, 4],
          [/toxic (adenoma|nodule|multinodular)/i, 4],
          [/tsh|free t4|t3\b/i, 2],
        ],
      },
      {
        id: 2,
        beat: 'complication',
        title: 'Tender gland',
        hook: 'Subacute vs silent vs postpartum thyroiditis: pain, ESR, and low uptake',
        patterns: [
          [/thyroiditis|subacute|de quervain|silent thyroiditis/i, 5],
          [/tender thyroid|painful thyroid/i, 4],
          [/postpartum thyroid/i, 4],
          [/low uptake|elevated (esr|crp)/i, 3],
          [/hashimoto/i, 2],
        ],
      },
      {
        id: 3,
        beat: 'deepening',
        title: 'Cold and slow',
        hook: 'Primary hypo vs central: TSH direction and when to image the pituitary',
        patterns: [
          [/hypothyroid|myxedema|hashimoto/i, 5],
          [/elevated tsh|high tsh/i, 3],
          [/central hypothyroidism|pituitary|low tsh.*low t4/i, 4],
          [/levothyroxine|replacement/i, 2],
          [/anti-?tpo|anti-?thyroid peroxidase/i, 3],
        ],
      },
      {
        id: 4,
        beat: 'turning point',
        title: 'Storm and coma',
        hook: 'Thyroid storm vs myxedema coma: ICU triggers and precipitants',
        patterns: [
          [/thyroid storm|thyrotoxic crisis/i, 5],
          [/myxedema coma/i, 5],
          [/fever|altered mental|precipitant/i, 2],
          [/ptu|methimazole|iodine|beta.?block/i, 3],
          [/hydrocortisone|stress dose/i, 2],
        ],
      },
      {
        id: 5,
        beat: 'resolution',
        title: 'Nodule next step',
        hook: 'Thyroid nodule vs cancer risk: FNA thresholds and cold-nodule traps',
        patterns: [
          [/thyroid nodule|fna\b|fine.?needle/i, 5],
          [/cold nodule|hot nodule|tirads|bethesda/i, 4],
          [/papillary|follicular|medullary|anaplastic/i, 4],
          [/calcitonin|ret\b|men\b/i, 3],
          [/ultrasound.*thyroid|thyroid ultrasound/i, 2],
        ],
      },
    ],
  },
  {
    set: 6,
    pattern: 'B',
    spine: 'Dyspnea — HF vs COPD vs pneumonia vs PE vs anemia',
    scenes: [
      {
        id: 1,
        beat: 'entry',
        title: 'Short of breath at rest',
        hook: 'CHF vs COPD exacerbation vs PE: wet vs dry lungs and BNP traps',
        patterns: [
          [/dyspnea|shortness of breath|short of breath/i, 3],
          [/heart failure|chf\b|orthopnea|pnd\b|elevated jvp/i, 5],
          [/copd|emphysema|chronic bronchitis/i, 4],
          [/bnp\b|nt-?probnp|pulmonary edema/i, 3],
          [/pulmonary emboli|pe\b/i, 3],
        ],
      },
      {
        id: 2,
        beat: 'complication',
        title: 'Wheeze and air trap',
        hook: 'Asthma vs COPD vs cardiac asthma: spirometry and steroid/response forks',
        patterns: [
          [/asthma|wheez|bronchospasm/i, 5],
          [/copd|fev1|obstructive/i, 4],
          [/albuterol|bronchodilator|inhaled corticosteroid/i, 3],
          [/peak flow|spirometr/i, 3],
          [/cardiac asthma|flash pulmonary/i, 3],
        ],
      },
      {
        id: 3,
        beat: 'deepening',
        title: 'Infiltrate or not',
        hook: 'CAP vs aspiration vs TB vs sterile CHF infiltrate',
        patterns: [
          [/pneumonia|infiltrate|consolidation/i, 4],
          [/aspiration|anaerobe|alcohol.*pneumonia/i, 4],
          [/tuberculosis|\btb\b|acid.?fast/i, 4],
          [/community.?acquired|curb|psi\b/i, 3],
          [/fever|leukocytosis|sputum/i, 2],
        ],
      },
      {
        id: 4,
        beat: 'turning point',
        title: 'Clot vs fluid',
        hook: 'PE vs decompensated HF: when CT-PA is wrong and when it is mandatory',
        patterns: [
          [/pulmonary emboli|pe\b|ct.?pa/i, 5],
          [/heart failure|volume overload|diuretic/i, 3],
          [/wells|geneva|d-?dimer/i, 3],
          [/right heart strain|rv strain/i, 3],
          [/hypoxemia|a-a gradient/i, 2],
        ],
      },
      {
        id: 5,
        beat: 'resolution',
        title: 'Blood too thin to carry',
        hook: 'Anemia vs hypoxia causes of dyspnea: when oxygen will not fix the story',
        patterns: [
          [/anemia|hemoglobin/i, 4],
          [/dyspnea|fatigue/i, 2],
          [/transfusion|iron/i, 2],
          [/methemoglob|carboxy|co poisoning/i, 4],
          [/oxygen|pulse ox|saturation/i, 2],
        ],
      },
    ],
  },
  {
    set: 7,
    pattern: 'B',
    spine: 'Acute abdomen — appy vs ectopic vs torsion vs pyelo vs diverticulitis',
    scenes: [
      {
        id: 1,
        beat: 'entry',
        title: 'RLQ clock',
        hook: 'Appendicitis vs mesenteric adenitis vs ovarian: migration, fever, imaging',
        patterns: [
          [/appendicit/i, 6],
          [/right lower|rlq|mcburney/i, 4],
          [/periumbilical.*migrat|migrat.*right/i, 3],
          [/ct abdomen|ultrasound.*appendix/i, 2],
          [/mesenteric adenitis/i, 3],
        ],
      },
      {
        id: 2,
        beat: 'complication',
        title: 'Pregnancy danger',
        hook: 'Ectopic vs miscarriage vs corpus luteum: beta-hCG and empty uterus',
        patterns: [
          [/ectopic/i, 6],
          [/beta.?hcg|pregnancy|amenorrhea/i, 3],
          [/adnexal|shoulder pain|ruptured ectopic/i, 4],
          [/methotrexate|salping/i, 3],
          [/miscarriage|threatened abort/i, 3],
        ],
      },
      {
        id: 3,
        beat: 'deepening',
        title: 'Twisted ovary or testis',
        hook: 'Torsion vs epididymitis vs PID: time-critical Doppler stories',
        patterns: [
          [/torsion|ovarian torsion|testicular torsion/i, 6],
          [/doppler|absent flow|whirlpool/i, 4],
          [/epididymitis|orchitis/i, 3],
          [/pid\b|pelvic inflammatory|cervical motion/i, 4],
          [/sudden.*pain|acute scrot/i, 2],
        ],
      },
      {
        id: 4,
        beat: 'turning point',
        title: 'Flank to belly',
        hook: 'Pyelo vs stone vs AAA: fever, CVA tenderness, and older-patient traps',
        patterns: [
          [/pyelonephritis|cva tenderness/i, 5],
          [/nephrolith|ureteral stone|flank pain/i, 4],
          [/abdominal aortic|aaa\b|pulsatile mass/i, 4],
          [/uti\b|dysuria|leukocyte esterase/i, 2],
          [/fever|sepsis/i, 2],
        ],
      },
      {
        id: 5,
        beat: 'resolution',
        title: 'Left side older gut',
        hook: 'Diverticulitis vs colitis vs ischemic bowel: LLQ and when to operate',
        patterns: [
          [/diverticulit/i, 6],
          [/left lower|llq/i, 3],
          [/abscess|perforation|hinchey/i, 3],
          [/ischemic colitis|mesenteric ischemia/i, 4],
          [/antibiotics|bowel rest|resect/i, 2],
        ],
      },
    ],
  },
  {
    set: 8,
    pattern: 'B',
    spine: 'Jaundice — hemolysis vs hepatitis vs cholestasis vs obstruction',
    scenes: [
      {
        id: 1,
        beat: 'entry',
        title: 'Yellow eyes, which path',
        hook: 'Prehepatic vs hepatic vs posthepatic: fractionated bilirubin first fork',
        patterns: [
          [/jaundice|icterus|hyperbilirubin/i, 4],
          [/indirect|unconjugated|gilbert|crigler/i, 4],
          [/direct|conjugated|cholestasis/i, 3],
          [/hepatitis|ast\b|alt\b/i, 3],
          [/obstruct|alkaline phosphatase|ggt\b/i, 3],
        ],
      },
      {
        id: 2,
        beat: 'complication',
        title: 'Viral vs toxin liver',
        hook: 'Viral hepatitis vs alcohol vs drug/APAP: pattern of enzymes and history',
        patterns: [
          [/hepatitis [abc]|hav\b|hbv\b|hcv\b/i, 5],
          [/acetaminophen|apap|n.?acetylcysteine/i, 5],
          [/alcoholic hepatitis|ast:alt|ast\/alt/i, 4],
          [/autoimmune hepatitis|anti-?smooth/i, 3],
          [/acute liver failure|encephalopath/i, 3],
        ],
      },
      {
        id: 3,
        beat: 'deepening',
        title: 'Stone in the duct',
        hook: 'Choledocholithiasis vs cholangitis vs pancreatitis: Charcot and Tokyo criteria',
        patterns: [
          [/choledocholith|common bile|cbd\b/i, 5],
          [/cholangitis|charcot|reynolds/i, 5],
          [/ercp|mrcp/i, 4],
          [/gallstone pancreatitis/i, 3],
          [/fever|jaundice|ruq/i, 2],
        ],
      },
      {
        id: 4,
        beat: 'turning point',
        title: 'Chronic scar',
        hook: 'Cirrhosis complications vs acute insult: ascites, SBP, varices forks',
        patterns: [
          [/cirrhosis|portal hypertension/i, 4],
          [/ascites|sbp\b|spontaneous bacterial/i, 5],
          [/varice|banding|octreotide/i, 4],
          [/hepatic encephalopathy|lactulose/i, 4],
          [/child.?pugh|meld\b/i, 3],
        ],
      },
      {
        id: 5,
        beat: 'resolution',
        title: 'Painless progressive',
        hook: 'Pancreatic head cancer vs chronic pancreatitis vs stricture: painless jaundice',
        patterns: [
          [/pancreatic (cancer|adenocarcinoma|head)/i, 5],
          [/painless jaundice|courvoisier/i, 4],
          [/biliary stricture|psc\b|primary sclerosing/i, 4],
          [/chronic pancreatitis/i, 3],
          [/ca.?19|whipple/i, 3],
        ],
      },
    ],
  },
  {
    set: 9,
    pattern: 'B',
    spine: 'Headache — migraine vs SAH vs meningitis vs temporal arteritis vs mass',
    scenes: [
      {
        id: 1,
        beat: 'entry',
        title: 'Usual migraine shape',
        hook: 'Migraine vs tension vs cluster: aura, laterality, and abortive rules',
        patterns: [
          [/migraine/i, 5],
          [/aura|photophobia|phonophobia|nausea/i, 3],
          [/tension.?type|cluster headache/i, 4],
          [/triptan|sumatriptan/i, 3],
          [/abortive|prophylaxis|propranolol|topiramate/i, 3],
        ],
      },
      {
        id: 2,
        beat: 'complication',
        title: 'Thunderclap',
        hook: 'SAH vs sentinel bleed vs reversible vasoconstriction: CT then LP timing',
        patterns: [
          [/subarachnoid|sah\b|thunderclap/i, 6],
          [/worst headache|sudden.*headache/i, 4],
          [/xanthochromia|lp\b|lumbar puncture/i, 4],
          [/berry aneurysm|coiling|nimodipine/i, 3],
          [/sentinel bleed/i, 3],
        ],
      },
      {
        id: 3,
        beat: 'deepening',
        title: 'Stiff and febrile',
        hook: 'Bacterial vs viral meningitis vs encephalitis: LP profiles and empiric drugs',
        patterns: [
          [/meningitis/i, 5],
          [/encephalitis|hsv\b|temporal lobe/i, 4],
          [/nuchal|neck stiffness|photophobia/i, 3],
          [/csf\b|opening pressure|neutrophilic|lymphocytic/i, 4],
          [/ceftriaxone|vancomycin|ampicillin|acyclovir/i, 3],
        ],
      },
      {
        id: 4,
        beat: 'turning point',
        title: 'Temple and vision',
        hook: 'GCA vs migraine in older adults: ESR/CRP and steroid-before-biopsy',
        patterns: [
          [/giant cell|temporal arteritis|gca\b/i, 6],
          [/jaw claudication|scalp tenderness/i, 4],
          [/amaurosis|vision loss|anterior ischemic/i, 4],
          [/esr\b|crp\b|polymyalgia/i, 3],
          [/prednisone|biopsy/i, 3],
        ],
      },
      {
        id: 5,
        beat: 'resolution',
        title: 'Mass effect',
        hook: 'Tumor vs abscess vs IIH: papilledema, progressive deficit, imaging first',
        patterns: [
          [/brain (tumor|mass|metastas)|glioblastoma|meningioma/i, 4],
          [/papilledema|intracranial pressure|iih\b|pseudotumor/i, 5],
          [/abscess|ring.?enhancing/i, 4],
          [/focal neurologic|progressive headache/i, 2],
          [/mri|ct head|contrast/i, 2],
        ],
      },
    ],
  },
  {
    set: 10,
    pattern: 'B',
    spine: 'Joint pain — septic vs gout vs RA vs OA vs reactive',
    scenes: [
      {
        id: 1,
        beat: 'entry',
        title: 'Hot single joint',
        hook: 'Septic arthritis vs crystal: aspirate before steroids, always',
        patterns: [
          [/septic arthritis|joint infection/i, 5],
          [/arthrocentesis|synovial|joint aspirat/i, 4],
          [/gout|pseudogout|cppd|urate|negatively birefringent/i, 4],
          [/fever|leukocytosis|unable to bear weight/i, 2],
          [/vancomycin|ceftriaxone|gonococcal/i, 3],
        ],
      },
      {
        id: 2,
        beat: 'complication',
        title: 'Crystal under light',
        hook: 'Gout vs CPPD vs hydroxyapatite: birefringence and joint choice',
        patterns: [
          [/gout|podagra|uric acid|allopurinol|colchicine/i, 5],
          [/pseudogout|cppd|positively birefringent|chondrocalcinosis/i, 5],
          [/first mtp|knee|wrist/i, 2],
          [/thiazide|tumor lysis/i, 2],
          [/nsaid|steroid.*joint/i, 2],
        ],
      },
      {
        id: 3,
        beat: 'deepening',
        title: 'Many joints, morning gel',
        hook: 'RA vs OA vs SLE arthritis: symmetric small joints vs wear-and-tear',
        patterns: [
          [/rheumatoid|anti-?ccp|rheumatoid factor/i, 5],
          [/osteoarthritis|heberden|bouchard|dip\b/i, 4],
          [/morning stiffness|symmetric|mcp\b|pip\b/i, 3],
          [/methotrexate|dmard/i, 3],
          [/swan.?neck|boutonniere|ulnar deviation/i, 3],
        ],
      },
      {
        id: 4,
        beat: 'turning point',
        title: 'After the bug',
        hook: "Reactive arthritis vs gonococcal vs IBD arthritis: can't see, can't climb, can't pee",
        patterns: [
          [/reactive arthritis|reiter/i, 5],
          [/urethritis|conjunctivitis|enthesitis|sacroili/i, 4],
          [/gonococcal|disseminated gonococ/i, 4],
          [/hla.?b27|ankylosing/i, 3],
          [/ibd\b|crohn|ulcerative colitis.*joint/i, 3],
        ],
      },
      {
        id: 5,
        beat: 'resolution',
        title: 'Back and sacroiliac',
        hook: 'Ankylosing vs mechanical back vs discitis: morning stiffness and bamboo spine',
        patterns: [
          [/ankylosing|bamboo spine|sacroiliitis/i, 5],
          [/inflammatory back|morning stiffness.*back/i, 4],
          [/discitis|osteomyelitis.*spine|epidural abscess/i, 4],
          [/mechanical back|strain|sciatica/i, 3],
          [/nsaid|tnf.?inhibitor|hla.?b27/i, 2],
        ],
      },
    ],
  },
];

function loadSet1Used() {
  if (!fs.existsSync(META1)) {
    require('child_process').execSync('node _extract-set1-meta.js', { cwd: ROOT, stdio: 'inherit' });
  }
  return new Set(JSON.parse(fs.readFileSync(META1, 'utf8')).ids.map(String));
}

function extractScaffold() {
  const html = fs.readFileSync(SET1, 'utf8');
  const itemsStart = html.indexOf('const ITEMS = ');
  const scenesLine = html.indexOf('\nconst SCENES');
  const head = html.slice(0, itemsStart);
  let tail = html.slice(scenesLine + 1); // starts at const SCENES

  // Drop hard-coded Set-1 STORY_STEPS; builder injects STORY_STEPS + optional flat render.
  const storyStart = tail.indexOf('const STORY_STEPS = ');
  const storyEnd = tail.indexOf('\nlet si = 0');
  if (storyStart < 0 || storyEnd < 0) {
    throw new Error('Could not locate STORY_STEPS block in Set 1 scaffold');
  }
  const beforeStory = tail.slice(0, storyStart);
  const afterStory = tail.slice(storyEnd + 1); // starts at "let si = 0"

  // Patch render to allow stages without stage tags (Pattern B flat scenes).
  let patched = afterStory.replace(
    /const storyHTML = steps\.map\(s =>\s*`<div class="story-beat"><span class="stage-tag">\$\{esc\(s\.stage\)}<\/span><p>\$\{chipify\(s\.text\)}<\/p><\/div>`\s*\)\.join\(''\);/,
    `const storyHTML = steps.map(s =>
    s.stage
      ? \`<div class="story-beat"><span class="stage-tag">\${esc(s.stage)}</span><p>\${chipify(s.text)}</p></div>\`
      : \`<div class="story-beat"><p>\${chipify(s.text)}</p></div>\`
  ).join('');`
  );

  return { head, beforeStory, afterStory: patched };
}

function replaceHeader(head, { setNum, pattern, spine }) {
  const title = `Set ${String(setNum).padStart(2, '0')} — ${spine.split('—')[0].trim()}`;
  const badge =
    pattern === 'A'
      ? 'v2 Pattern A — each scene runs Dan Harmon\'s Story Circle. One real question per stage.'
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
  </header>`
  );
  return h;
}

function writeSetHtml({ setNum, pattern, spine, items, storySteps, scaffold }) {
  const fname = `set-${String(setNum).padStart(2, '0')}-story-v${pattern.toLowerCase()}.html`;
  const head = replaceHeader(scaffold.head, { setNum, pattern, spine });
  const storyBlock = `const STORY_STEPS = ${JSON.stringify(storySteps, null, 2)};

`;
  const html =
    head +
    `const ITEMS = ${JSON.stringify(items)};\n\n` +
    scaffold.beforeStory +
    storyBlock +
    scaffold.afterStory;

  fs.writeFileSync(path.join(ROOT, fname), html);
  return fname;
}

function main() {
  console.log('Loading bank…');
  const pool = loadDeduped();
  console.log('Unique QIDs:', pool.length);

  const used = loadSet1Used();
  console.log('Set 1 reserved IDs:', used.size);

  const scaffold = extractScaffold();
  const manifest = [];

  // Set 1 row for manifest
  const meta1 = JSON.parse(fs.readFileSync(META1, 'utf8'));
  manifest.push({
    set: 1,
    file: 'set-01-story-va.html',
    pattern: 'A',
    spine: 'Lupus / CTD — skin photo fork — lung fork — nephritis — treatment',
    questionCount: meta1.n,
    scenes: meta1.scenes.map((s) => ({
      sid: s.sid,
      title: s.title,
      differential: s.hook,
      count: s.ids.length,
      flagged: null,
    })),
    notes: 'Canonical Set 1 template from spine-story-demo-v2.html — not regenerated.',
  });

  for (const chain of CHAINS) {
    console.log(`\n=== Set ${chain.set} (${chain.pattern}) ${chain.spine} ===`);
    const sceneResults = [];
    const flags = [];
    for (const sc of chain.scenes) {
      let { picks, weak, available } = pickForScene(pool, sc, used, 8, 3);
      if (picks.length < 8) {
        // soften once
        const more = pickForScene(pool, sc, used, 8 - picks.length, 2);
        picks = picks.concat(more.picks);
        weak = weak.concat(more.weak);
        available += more.available;
        if (picks.length < 8) {
          flags.push(
            `Scene ${sc.id} short: ${picks.length}/8 (available≥min ${available}) — ${sc.hook}`
          );
        } else {
          flags.push(`Scene ${sc.id}: filled with lower-confidence matches (minScore 2)`);
        }
      }
      if (weak.length >= 4) {
        flags.push(`Scene ${sc.id}: ${weak.length}/8 picks scored <5 — review cluster strength`);
      }
      sceneResults.push({
        ...sc,
        questions: picks.map((q) => ({
          id: q.id,
          sceneScore: q.sceneScore,
          question: q.question,
          answers: normalizeAnswers(q.answers),
          explanation: q.explanation,
          likely: q.likely,
          hasReveal: q.hasReveal,
          sourceFile: q.sourceFile,
        })),
      });
      console.log(
        `  S${sc.id}: ${picks.length}/8 (top scores ${picks
          .slice(0, 3)
          .map((p) => p.sceneScore)
          .join(',')})`
      );
    }

    const items = [];
    for (const sc of sceneResults) {
      sc.questions.forEach((q, i) => {
        items.push({
          sceneId: sc.id,
          sceneBeat: sc.beat,
          sceneTitle: sc.title,
          sceneHook: sc.hook,
          indexInScene: i + 1,
          sceneSize: sc.questions.length,
          globalIndex: items.length + 1,
          id: q.id,
          sceneScore: q.sceneScore,
          question: q.question,
          answers: q.answers,
          explanation: q.explanation,
          likely: q.likely,
          hasReveal: q.hasReveal,
        });
      });
    }

    const storySteps = buildStorySteps(
      sceneResults.map((s) => ({ id: s.id, title: s.title, hook: s.hook })),
      chain.pattern
    );

    const fname = writeSetHtml({
      setNum: chain.set,
      pattern: chain.pattern,
      spine: chain.spine,
      items,
      storySteps,
      scaffold,
    });

    manifest.push({
      set: chain.set,
      file: fname,
      pattern: chain.pattern,
      spine: chain.spine,
      questionCount: items.length,
      scenes: sceneResults.map((s) => ({
        sid: s.id,
        title: s.title,
        differential: s.hook,
        count: s.questions.length,
        flagged: s.questions.length < 8 ? `short ${s.questions.length}/8` : null,
      })),
      notes: flags.length ? flags.join('; ') : 'ok',
    });
    console.log('  Wrote', fname, items.length, 'Qs');
  }

  const md = [
    '# Sets manifest — Draft Sets 1–10',
    '',
    'Status: **DRAFT** for Master review. Placeholder avatar = Nadia & Dr. Iwu everywhere.',
    'Pattern A = full Harmon Circle every scene. Pattern B = Circle only on scenes 1 & 5; middle flattened.',
    '',
  ];
  for (const m of manifest) {
    md.push(`## Set ${m.set} — Pattern ${m.pattern}`);
    md.push(`- **File:** \`${m.file}\``);
    md.push(`- **Chain:** ${m.spine}`);
    md.push(`- **Questions:** ${m.questionCount}${m.questionCount < 40 ? ' ⚠️ short' : ''}`);
    md.push(`- **Notes:** ${m.notes}`);
    md.push(`- **Scene differentials:**`);
    for (const s of m.scenes) {
      md.push(
        `  - Scene ${s.sid} (${s.count}): ${s.differential}${s.flagged ? ` — **${s.flagged}**` : ''}`
      );
    }
    md.push('');
  }
  fs.writeFileSync(path.join(ROOT, 'sets-manifest.md'), md.join('\n'));
  fs.writeFileSync(path.join(ROOT, 'sets-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nWrote sets-manifest.md');
}

main();
