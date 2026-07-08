import preparedBundle from '../data/preparedCases.json' with { type: 'json' };
import { isUberCase } from './uberCases.js';

export const STUDY_BATCH_SIZE = 5;

const THEME_BUCKETS = [
  [/chest|dyspnea|sob|breath|respiratory|pneumo|pulmonary|cardiac/i, 'Cardiopulmonary'],
  [/abdominal|belly|nausea|vomit|diarr|constipation|gi\b/i, 'GI & abdomen'],
  [/weakness|numbness|seizure|headache|mental|neuro|paralysis|dizziness|syncope/i, 'Neurology'],
  [/fever|rash|infection|sepsis/i, 'Infectious'],
  [/pelvic|vaginal|ob|pregnan|uter/i, 'OB/GYN'],
  [/pediatric|child|infant|feeding|enuresis/i, 'Pediatrics'],
  [/psych|depress|anxiety|paranoia|suicid/i, 'Psychiatry'],
  [/renal|urin|kidney|flank/i, 'Genitourinary'],
  [/joint|msk|back pain|fracture/i, 'MSK'],
];

function normalizeCaseId(caseId) {
  const raw = String(caseId ?? '').trim();
  return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw;
}

export function isUberCatalogId(caseId) {
  return isUberCase(caseId) || /^U\d+/i.test(String(caseId ?? '').trim());
}

/** Drop uber composite ids from a category list — uber lives in its own top section. */
export function withoutUberCases(cases = []) {
  return (Array.isArray(cases) ? cases : []).filter((c) => c && !isUberCatalogId(c.id));
}

function themeForCase(c) {
  const id = normalizeCaseId(c.id);
  const pk = preparedBundle?.cases?.[id]?.presentationKey;
  if (pk) return String(pk).trim();
  const title = String(c.title || c.chief_complaint || '').toLowerCase();
  for (const [re, label] of THEME_BUCKETS) {
    if (re.test(title)) return label;
  }
  const words = String(c.title || 'Case')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return words.join(' ') || 'Mixed';
}

function summarizeBatchTheme(cases) {
  const themes = [...new Set(cases.map(themeForCase))];
  if (themes.length === 1) return themes[0];
  return themes.slice(0, 2).join(' · ');
}

/**
 * Group similar cases into study batches of five (Pediatrics-style bite-sized goals).
 * Similar = shared presentationKey or theme bucket; sorted before chunking.
 */
export function buildStudyBatches(cases, { batchSize = STUDY_BATCH_SIZE } = {}) {
  const regular = withoutUberCases(cases);
  if (!regular.length) return [];

  if (regular.length <= batchSize) {
    return [
      {
        batchIndex: 0,
        batchNumber: 1,
        totalBatches: 1,
        theme: summarizeBatchTheme(regular),
        cases: regular,
      },
    ];
  }

  const sorted = [...regular].sort((a, b) => {
    const ta = themeForCase(a);
    const tb = themeForCase(b);
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a.title || '').localeCompare(String(b.title || ''));
  });

  const batches = [];
  for (let i = 0; i < sorted.length; i += batchSize) {
    const slice = sorted.slice(i, i + batchSize);
    batches.push({
      batchIndex: batches.length,
      batchNumber: batches.length + 1,
      totalBatches: 0,
      theme: summarizeBatchTheme(slice),
      cases: slice,
    });
  }
  batches.forEach((b) => {
    b.totalBatches = batches.length;
  });
  return batches;
}

export function studyCategories(categories = []) {
  return (Array.isArray(categories) ? categories : []).filter((c) => c?.id && c.id !== 'Uber Cases');
}

export function batchLabel(batch) {
  if (!batch) return 'Batch';
  if (batch.totalBatches <= 1) return batch.theme || 'All cases';
  return `Batch ${batch.batchNumber} — ${batch.theme || 'mixed'}`;
}
