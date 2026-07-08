/**
 * Anchor cases live under data/cases/ (not preparedCases.json).
 * Uber merge loads their stacks as intervention objects for member IDs like 195.
 */
import case195 from '../../data/cases/case_195.json' with { type: 'json' };

const ANCHOR_BY_ID = {
  '195': case195,
};

/** @typedef {{ id: string, label: string, correct_zone: string, why: string, guideline: string, teachingChannel: string }} PreparedIntervention */

/** Expand case_195 stacks into preparedCases-style intervention rows. */
const CASE_195_INTERVENTIONS = [
  {
    id: 'ciwa-ar-scoring',
    label: 'CIWA-Ar scoring',
    correct_zone: 'zone-arm',
    why: 'Last drink 36 hours ago with tremor and diaphoresis — scale-guided lorazepam or diazepam reduces seizure and DT risk.',
    guideline: 'First Aid',
    teachingChannel: 'workup',
  },
  {
    id: 'benzodiazepine-diazepam-lorazepam-chlord',
    label: 'Benzodiazepine (Diazepam / Lorazepam / Chlordiazepoxide)',
    correct_zone: 'zone-iv-bag',
    why: 'Symptom-triggered benzodiazepines per CIWA — first-line for alcohol withdrawal.',
    guideline: 'First Aid',
    teachingChannel: 'workup',
  },
  {
    id: 'thiamine-iv-im',
    label: 'Thiamine (IV/IM)',
    correct_zone: 'zone-arm',
    why: 'Give thiamine before glucose in at-risk drinkers — prevents Wernicke encephalopathy.',
    guideline: 'First Aid',
    teachingChannel: 'workup',
  },
  {
    id: 'folic-acid',
    label: 'Folic acid',
    correct_zone: 'zone-arm',
    why: 'Chronic alcohol use depletes folate — empiric repletion with thiamine and B6 in withdrawal.',
    guideline: 'First Aid',
    teachingChannel: 'workup',
  },
  {
    id: 'vitamin-b6-pyridoxine',
    label: 'Vitamin B6 (pyridoxine)',
    correct_zone: 'zone-arm',
    why: 'Empiric B6 with thiamine and folate in chronic alcohol abuse — supports neurotransmitter synthesis.',
    guideline: 'First Aid',
    teachingChannel: 'workup',
  },
  {
    id: 'multivitamin-b-complex',
    label: 'Multivitamin / B-complex',
    correct_zone: 'zone-arm',
    why: 'Banana-bag style repletion — malnourished drinker at Wernicke risk.',
    guideline: 'First Aid',
    teachingChannel: 'workup',
  },
  {
    id: 'bmp-cmp',
    label: 'BMP / CMP',
    correct_zone: 'zone-blood',
    why: 'Correct electrolyte derangements and assess renal function in withdrawal.',
    guideline: 'First Aid',
    teachingChannel: 'workup',
  },
  {
    id: 'lfts',
    label: 'LFTs',
    correct_zone: 'zone-arm',
    why: 'Assess hepatic injury from chronic alcohol use.',
    guideline: 'First Aid',
    teachingChannel: 'workup',
  },
  {
    id: 'magnesium-potassium-replacement',
    label: 'Magnesium / Potassium replacement',
    correct_zone: 'zone-iv-bag',
    why: 'Correct hypomagnesemia — common in AUD and lowers seizure threshold in withdrawal.',
    guideline: 'First Aid',
    teachingChannel: 'workup',
  },
  {
    id: 'ethanol-toxic-alcohol-panel',
    label: 'Ethanol / Toxic alcohol panel',
    correct_zone: 'zone-arm',
    why: 'Low ethanol level confirms withdrawal timing; rule out co-ingestants.',
    guideline: 'First Aid',
    teachingChannel: 'workup',
  },
  {
    id: 'fingerstick-glucose',
    label: 'Fingerstick glucose',
    correct_zone: 'zone-blood',
    why: 'Check glucose after thiamine — hypoglycemia mimics withdrawal; never give D50 before thiamine.',
    guideline: 'First Aid',
    teachingChannel: 'workup',
  },
  {
    id: 'admit-to-icu',
    label: 'Admit to ICU',
    correct_zone: 'zone-icu',
    why: 'History of prior DT — lower threshold for ICU and continuous monitoring.',
    guideline: 'First Aid',
    teachingChannel: 'disposition',
  },
  {
    id: 'monitor-delirium-tremens',
    label: 'Monitor for delirium tremens',
    correct_zone: 'zone-monitor',
    why: 'Visual hallucinations today — track autonomic instability, agitation, and fever for DT progression.',
    guideline: 'First Aid',
    teachingChannel: 'workup',
  },
  {
    id: 'consult-addiction-medicine',
    label: 'Consult, addiction medicine / substance abuse',
    correct_zone: 'zone-icu',
    why: 'Link to detox, counseling, and relapse prevention after medical stabilization.',
    guideline: 'First Aid',
    teachingChannel: 'consult',
  },
  {
    id: 'consult-psychiatry',
    label: 'Consult, psychiatry',
    correct_zone: 'zone-icu',
    why: 'Psychiatry involvement for mood, relapse, and disposition after withdrawal stabilization.',
    guideline: 'First Aid',
    teachingChannel: 'consult',
  },
  {
    id: 'safety-assessment-relapse',
    label: 'Safety assessment after intentional relapse',
    correct_zone: 'zone-icu',
    why: 'Document intent, supports, and safety if withdrawal followed deliberate drinking after job loss.',
    guideline: 'First Aid',
    teachingChannel: 'consult',
  },
];

const INTERVENTIONS_BY_ANCHOR_ID = {
  '195': CASE_195_INTERVENTIONS,
};

/**
 * @param {string} memberId Normalized member case id (e.g. "195")
 * @returns {PreparedIntervention[]|null}
 */
function normalizeAnchorId(memberId) {
  const raw = String(memberId ?? '').trim();
  return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw;
}

export function getAnchorCaseInterventions(memberId) {
  const normalized = normalizeAnchorId(memberId);
  if (!ANCHOR_BY_ID[normalized]) return null;
  return INTERVENTIONS_BY_ANCHOR_ID[normalized] || null;
}

export function getAnchorCaseRecord(memberId) {
  return ANCHOR_BY_ID[normalizeAnchorId(memberId)] || null;
}
