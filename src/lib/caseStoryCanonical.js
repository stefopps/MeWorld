/** Canonical case-story fingerprints — reject LLM/cache bleed from other cases. */

export const CANONICAL_CASE_STORY_IDS = new Set(['001', '051', '153', '176']);

function normalizeCaseId(caseId) {
  const raw = String(caseId ?? '').replace(/^case[_-]?/i, '').trim();
  return raw ? raw.padStart(3, '0') : '';
}

const MARKERS = {
  '153': {
    required: /ng'avu|porphyr|blister|yellow jacket|beer|pct|sunburn|village party/i,
    forbidden: /rabies|dog bite|stray dog|bedroom floor|peppered|70-year-old caucasian|\btia\b|post-ictal|seizure leaves him/i,
  },
  '176': {
    required: /rabies|dog bite|forearm|cellulitis|tetanus/i,
    forbidden: /bedroom floor getting up to urinate|peppered with emboli|ng'avu|porphyrin blister/i,
  },
  '051': {
    required: /peppered|tia|stroke|carotid|mri|dwI/i,
    forbidden: /rabies|ng'avu|porphyr|dog bite/i,
  },
  '001': {
    required: /pneumothorax|breath sound|decompress|tension/i,
    forbidden: /rabies|ng'avu|bedroom floor/i,
  },
};

export function storyNarrativeMatchesCase(caseId, narrative = {}) {
  const cid = normalizeCaseId(caseId);
  const rules = MARKERS[cid];
  if (!rules) return true;
  const blob = [
    narrative?.title,
    narrative?.synopsis,
    narrative?.patientLock,
    ...(narrative?.chapters || []).map((c) => `${c.heading} ${c.body} ${c.visualHint}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (rules.forbidden.test(blob)) return false;
  if (rules.required && !rules.required.test(blob)) return false;
  return true;
}

export function isCanonicalCaseStory(caseId) {
  return CANONICAL_CASE_STORY_IDS.has(normalizeCaseId(caseId));
}
