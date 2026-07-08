/** Pertinent decoy orders — case-specific near-misses mixed into stacks. */

const MIN_DECOYS = 6;
const MAX_DECOYS = 10;

const GENERIC_DECOYS = [
  {
    label: 'Ordered the following: CT Head',
    why: 'Neuroimaging is not indicated when the presentation is not neurologic.',
    correct_zone: 'zone-monitor',
  },
  {
    label: 'Ordered the following: Urinalysis',
    why: 'GU testing is not the first-line workup for this presentation.',
    correct_zone: 'zone-blood',
  },
];

/** Near-miss decoys keyed by diagnosis / presentation — tried before generic pools. */
const DIAGNOSIS_NEAR_MISSES = [
  {
    match: /tuberculosis|\btb\b|mycobacter/i,
    decoys: [
      {
        label: 'Ordered the following: Quantiferon-TB Gold',
        why: 'IGRA alone does not replace sputum testing and targeted TB skin testing in this CCS pathway.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: AFB Smear',
        why: 'AFB smear without the full sputum culture workup is incomplete for this case script.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: Blood Cultures',
        why: 'Blood cultures are not the primary specimen for pulmonary TB evaluation.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: Bronchoscopy',
        why: 'Bronchoscopy is not first-line before basic imaging, cultures, and TB testing.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: CT Chest',
        why: 'CT chest jumps ahead of chest radiograph and microbiologic testing here.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: Thoracentesis',
        why: 'Pleural drainage is not indicated without evidence of a drainable effusion.',
        correct_zone: 'zone-arm',
      },
      {
        label: 'Ordered the following: Empiric RIPE Therapy',
        why: 'Full TB treatment should follow diagnostic confirmation, not precede it.',
        correct_zone: 'zone-arm',
      },
      {
        label: 'Ordered the following: Legionella Urinary Antigen',
        why: 'Legionella testing is a distractor from mycobacterial workup in this script.',
        correct_zone: 'zone-blood',
      },
    ],
  },
  {
    match: /community acquired pneumonia|pneumonia|cap\b/i,
    decoys: [
      {
        label: 'Ordered the following: CT Chest',
        why: 'CT chest is not first-line when chest radiograph and cultures are appropriate.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: Blood Cultures',
        why: 'Blood cultures alone miss the primary pulmonary source workup.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: Influenza Testing',
        why: 'Viral swab alone does not complete bacterial pneumonia evaluation.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: COVID Testing',
        why: 'COVID testing alone does not complete the pneumonia workup.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: Procalcitonin',
        why: 'Biomarkers do not replace imaging and cultures in this pathway.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: Empiric Azithromycin',
        why: 'Empiric antibiotics before targeted testing can mislead the workup.',
        correct_zone: 'zone-arm',
      },
      {
        label: 'Ordered the following: Bronchodilator Nebulizer',
        why: 'Bronchodilator therapy is not the primary step before diagnosis.',
        correct_zone: 'zone-arm',
      },
    ],
  },
  {
    match: /chest pain|stemi|nstemi|acs|myocardial infarction|angina/i,
    decoys: [
      {
        label: 'Ordered the following: CT Pulmonary Angiography',
        why: 'CTA is not first-line when ACS is the leading concern.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: Chest X-ray',
        why: 'CXR is secondary when immediate ECG and troponin are indicated.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: D-Dimer',
        why: 'D-dimer is not the priority test in high-risk chest pain.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: Stress Test',
        why: 'Stress testing is inappropriate in the acute ED chest pain evaluation.',
        correct_zone: 'zone-monitor',
      },
    ],
  },
  {
    match: /pulmonary embol|pe\b|dyspnea|shortness of breath/i,
    decoys: [
      {
        label: 'Ordered the following: Chest X-ray',
        why: 'CXR alone cannot rule out PE when embolism is suspected.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: ECG',
        why: 'ECG alone does not evaluate for pulmonary embolism.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: D-Dimer',
        why: 'D-dimer without structured PE risk stratification is insufficient here.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: CT Chest',
        why: 'Routine CT chest is not the same as CT pulmonary angiography for PE.',
        correct_zone: 'zone-monitor',
      },
    ],
  },
  {
    match: /sepsis|bacteremia|neutropenic fever/i,
    decoys: [
      {
        label: 'Ordered the following: Chest X-ray',
        why: 'Imaging alone does not replace cultures and lactate in sepsis.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: Urinalysis',
        why: 'UA alone is insufficient for systemic sepsis evaluation.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: Blood Cultures',
        why: 'Cultures without source control and resuscitation steps miss the pathway.',
        correct_zone: 'zone-blood',
      },
    ],
  },
  {
    match: /pharyngitis|strep throat|sore throat/i,
    decoys: [
      {
        label: 'Ordered the following: Chest X-ray',
        why: 'Chest imaging is not first-line for isolated pharyngitis.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: Blood Cultures',
        why: 'Blood cultures are not indicated for uncomplicated pharyngitis.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: Monospot Test',
        why: 'Monospot targets mononucleosis, not the strep pathway in this case.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: Throat Culture',
        why: 'Culture timing and rapid strep strategy matter — this distractor skips the CCS sequence.',
        correct_zone: 'zone-blood',
      },
    ],
  },
  {
    match: /dvt|deep venous thrombosis|venous thrombo/i,
    decoys: [
      {
        label: 'Ordered the following: Chest X-ray',
        why: 'CXR does not evaluate lower-extremity venous thrombosis.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: D-Dimer',
        why: 'D-dimer alone does not replace vascular imaging when DVT is suspected.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: CT Pulmonary Angiography',
        why: 'PE imaging is not the first step when isolated DVT is the presentation.',
        correct_zone: 'zone-monitor',
      },
    ],
  },
  {
    match: /trauma|fracture|laceration|hemoperitoneum/i,
    decoys: [
      {
        label: 'Ordered the following: MRI Spine',
        why: 'MRI is not first-line in the acute trauma survey.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: CT Head',
        why: 'Head CT may distract from the primary traumatic injury in this script.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: Urinalysis',
        why: 'GU testing does not address the traumatic injury mechanism.',
        correct_zone: 'zone-blood',
      },
    ],
  },
];

const RESPIRATORY_DECOYS = [
  {
    label: 'Ordered the following: Influenza Testing',
    why: 'Viral swab alone may miss the primary diagnosis in this respiratory script.',
    correct_zone: 'zone-blood',
  },
  {
    label: 'Ordered the following: COVID Testing',
    why: 'COVID testing alone does not complete the respiratory workup.',
    correct_zone: 'zone-blood',
  },
  {
    label: 'Ordered the following: Throat Culture',
    why: 'Upper airway culture does not evaluate lower respiratory pathology.',
    correct_zone: 'zone-blood',
  },
  {
    label: 'Ordered the following: Arterial Blood Gas',
    why: 'ABG is not required before basic vitals and chest imaging in stable patients.',
    correct_zone: 'zone-blood',
  },
];

/** Wrong-but-plausible sibling when a specific correct order is in the case. */
const INTERVENTION_SIBLINGS = [
  {
    match: /chest x[- ]?ray|cxr/i,
    decoys: [
      {
        label: 'Ordered the following: CT Chest',
        why: 'CT is a near-miss — plain radiograph comes first in this pathway.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: Lung Ultrasound',
        why: 'Bedside ultrasound does not replace the expected imaging step here.',
        correct_zone: 'zone-monitor',
      },
    ],
  },
  {
    match: /sputum/i,
    decoys: [
      {
        label: 'Ordered the following: AFB Smear',
        why: 'Smear without full culture workup is incomplete for this case.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: Blood Cultures',
        why: 'Blood cultures are the wrong specimen for primary pulmonary infection here.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: Gram Stain',
        why: 'Gram stain alone is not the CCS-specified culture pathway.',
        correct_zone: 'zone-blood',
      },
    ],
  },
  {
    match: /tb skin|ppd|tuberculin/i,
    decoys: [
      {
        label: 'Ordered the following: Quantiferon-TB Gold',
        why: 'IGRA is a near-miss but not the ordered TB skin test in this script.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: Chest X-ray',
        why: 'Imaging alone does not substitute for TB skin testing here.',
        correct_zone: 'zone-monitor',
      },
    ],
  },
  {
    match: /\bcbc\b|complete blood count/i,
    decoys: [
      {
        label: 'Ordered the following: BMP',
        why: 'BMP is a near-miss — the case expects CBC for this workup.',
        correct_zone: 'zone-blood',
      },
      {
        label: 'Ordered the following: Procalcitonin',
        why: 'Inflammatory markers do not replace CBC in this pathway.',
        correct_zone: 'zone-blood',
      },
    ],
  },
  {
    match: /physical exam|vitals/i,
    decoys: [
      {
        label: 'Ordered the following: Pulse Oximetry Only',
        why: 'Spot-check oximetry is not the full vitals/exam sequence expected.',
        correct_zone: 'zone-monitor',
      },
    ],
  },
  {
    match: /lactate/i,
    decoys: [
      {
        label: 'Ordered the following: VBG',
        why: 'Venous blood gas is a near-miss when lactate is the indicated marker.',
        correct_zone: 'zone-blood',
      },
    ],
  },
  {
    match: /ecg|ekg|troponin/i,
    decoys: [
      {
        label: 'Ordered the following: Chest X-ray',
        why: 'CXR is a near-miss that delays the cardiac pathway.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: D-Dimer',
        why: 'D-dimer distracts from ACS evaluation in this script.',
        correct_zone: 'zone-blood',
      },
    ],
  },
  {
    match: /ct scan|ct abdomen|ct pelvis/i,
    decoys: [
      {
        label: 'Ordered the following: MRI',
        why: 'MRI is a near-miss when CT is already the imaging anchor.',
        correct_zone: 'zone-monitor',
      },
      {
        label: 'Ordered the following: Ultrasound',
        why: 'Ultrasound does not replace the expected CT step here.',
        correct_zone: 'zone-monitor',
      },
    ],
  },
];

function normalizeLabel(label) {
  return neutralStackOrderName(label).toLowerCase().replace(/\s+/g, ' ');
}

function targetDecoyCount(interventions = []) {
  const n = interventions.length || 4;
  // ~1:1 decoys to correct orders — forces picking the right stack in a crowded list.
  return Math.max(MIN_DECOYS, Math.min(MAX_DECOYS, n));
}

function caseHaystack(caseData = {}) {
  return [
    caseData.diagnosis,
    caseData.title,
    caseData.category,
    caseData.chief_complaint,
    caseData.presentationKey,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function diagnosisNearMissPool(caseData) {
  const hay = caseHaystack(caseData);
  const pool = [];
  for (const script of DIAGNOSIS_NEAR_MISSES) {
    if (script.match.test(hay)) pool.push(...script.decoys);
  }
  if (/cough|respiratory|dyspnea|sob|lung/i.test(hay) && !pool.length) {
    pool.push(...RESPIRATORY_DECOYS);
  }
  return pool;
}

function siblingNearMissPool(interventions = []) {
  const pool = [];
  const joined = interventions
    .map((iv) => neutralStackOrderName(iv.label))
    .join(' | ');
  for (const group of INTERVENTION_SIBLINGS) {
    if (group.match.test(joined)) pool.push(...group.decoys);
  }
  return pool;
}

function bankDecoyToStack(decoy, caseId, idx) {
  return {
    id: decoy.id || `decoy-bank-${caseId}-${idx}`,
    label: neutralStackOrderName(decoy.label),
    why: decoy.why || decoy.reason_wrong || 'Incorrect for this presentation.',
    correct_zone: decoy.correct_zone || 'zone-monitor',
    isSupplemental: false,
  };
}

function pushDecoy(list, seen, correctLabels, template, caseId) {
  const key = normalizeLabel(template.label);
  if (!key || seen.has(key) || correctLabels.has(key)) return false;
  seen.add(key);
  list.push({
    id: `decoy-sup-${caseId}-${list.length}`,
    label: neutralStackOrderName(template.label),
    why: template.why,
    correct_zone: template.correct_zone || 'zone-monitor',
    isSupplemental: true,
  });
  return true;
}

/** Case-specific near-miss decoys — shuffled with real stacks in play. */
export function resolveStackDecoys(caseData = {}, interventions = []) {
  const caseId = String(caseData.id ?? '0');
  const correctLabels = new Set(interventions.map((iv) => normalizeLabel(iv.label)));
  const target = targetDecoyCount(interventions);

  const fromBank = (Array.isArray(caseData.decoys) ? caseData.decoys : [])
    .filter((d) => d?.label && !correctLabels.has(normalizeLabel(d.label)))
    .map((d, idx) => bankDecoyToStack(d, caseId, idx));

  const seen = new Set(fromBank.map((d) => normalizeLabel(d.label)));
  const supplemental = [];

  const pools = [
    diagnosisNearMissPool(caseData),
    siblingNearMissPool(interventions),
    RESPIRATORY_DECOYS,
    GENERIC_DECOYS,
  ];

  for (const pool of pools) {
    for (const template of pool) {
      if (fromBank.length + supplemental.length >= target) break;
      pushDecoy(supplemental, seen, correctLabels, template, caseId);
    }
    if (fromBank.length + supplemental.length >= target) break;
  }

  return [...fromBank, ...supplemental];
}

const CCS_LABEL_PREFIXES = [
  /^Should have ordered:\s*/i,
  /^Ordered the following:\s*/i,
  /^Correctly avoided:\s*/i,
  /^Should not(?: have)? ordered:\s*/i,
];

/** Strip CCS review scaffolding — show plain order names during practice. */
export function neutralStackOrderName(label) {
  let out = String(label || '').trim();
  for (const re of CCS_LABEL_PREFIXES) {
    out = out.replace(re, '');
  }
  return out.trim() || String(label || '').trim();
}

/**
 * Stack pill text in the sidebar.
 * Practice: neutral order entry (no “should have ordered” hints).
 * Teach Me: full CCS labels for review learning.
 */
export function stackPillDisplayLabel(iv) {
  return neutralStackOrderName(iv?.label || '');
}
