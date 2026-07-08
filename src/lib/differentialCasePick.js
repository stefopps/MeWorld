import catalog from '../data/ccsCatalog.json';
import { readCaseTranscriptArchive, readDifferentialLog } from './differentialPracticeLog.js';

/** Share of picks from untouched specialty categories when any remain. */
const UNTOUCHED_CATEGORY_BIAS = 0.88;
/** Within a category pool, prefer cases never practiced. */
const UNTOUCHED_CASE_BIAS = 0.75;

const caseIdToCategoryId = new Map();
for (const cat of catalog.categories || []) {
  for (const rawId of cat.caseIds || []) {
    const num = parseInt(String(rawId), 10);
    if (!Number.isFinite(num) || caseIdToCategoryId.has(num)) continue;
    caseIdToCategoryId.set(num, cat.id);
  }
}

export function getCategoryIdForCaseId(caseId) {
  if (caseId == null) return null;
  return caseIdToCategoryId.get(Number(caseId)) || null;
}

export function getTouchedCategoryIds() {
  const touched = new Set();
  for (const attempt of readDifferentialLog().attempts) {
    const cat = getCategoryIdForCaseId(attempt.caseId);
    if (cat) touched.add(cat);
  }
  for (const id of Object.keys(readCaseTranscriptArchive().cases || {})) {
    const cat = getCategoryIdForCaseId(Number(id));
    if (cat) touched.add(cat);
  }
  return touched;
}

export function getTouchedCaseIds() {
  const touched = new Set();
  for (const attempt of readDifferentialLog().attempts) {
    if (attempt.caseId != null) touched.add(String(attempt.caseId));
  }
  for (const id of Object.keys(readCaseTranscriptArchive().cases || {})) {
    touched.add(String(id));
  }
  return touched;
}

function pickUniform(indices) {
  if (!indices.length) return null;
  return indices[Math.floor(Math.random() * indices.length)];
}

function splitFreshAndRepeat(bank, indices, touchedCaseIds) {
  const fresh = [];
  const repeat = [];
  for (const idx of indices) {
    const id = String(bank[idx]?.caseId ?? '');
    if (id && !touchedCaseIds.has(id)) fresh.push(idx);
    else repeat.push(idx);
  }
  return { fresh, repeat };
}

function pickBiasedFromIndices(bank, indices) {
  if (!indices.length) return null;
  const touchedCategories = getTouchedCategoryIds();
  const touchedCases = getTouchedCaseIds();

  const untouchedCategory = [];
  const touchedCategory = [];
  for (const idx of indices) {
    const cat = getCategoryIdForCaseId(bank[idx]?.caseId);
    if (cat && !touchedCategories.has(cat)) untouchedCategory.push(idx);
    else touchedCategory.push(idx);
  }

  let pool = indices;
  if (untouchedCategory.length && Math.random() < UNTOUCHED_CATEGORY_BIAS) {
    pool = untouchedCategory;
  } else if (touchedCategory.length) {
    pool = touchedCategory;
  }

  const { fresh, repeat } = splitFreshAndRepeat(bank, pool, touchedCases);
  if (fresh.length && Math.random() < UNTOUCHED_CASE_BIAS) {
    return pickUniform(fresh);
  }
  return pickUniform(repeat.length ? repeat : pool);
}

/**
 * Pick a bank index, avoiding excludeIdx when possible.
 * Prefers cases in specialty categories the learner has not practiced yet.
 */
export function pickDifferentialCaseIndex(bank, excludeIdx = -1) {
  if (!bank?.length) return 0;
  if (bank.length === 1) return 0;

  const candidates = [];
  for (let i = 0; i < bank.length; i += 1) {
    if (i !== excludeIdx) candidates.push(i);
  }
  const picked = pickBiasedFromIndices(bank, candidates);
  if (picked != null) return picked;

  let next = excludeIdx;
  while (next === excludeIdx) {
    next = Math.floor(Math.random() * bank.length);
  }
  return next;
}

/** Stacker: pick from remaining unseen indices with the same category bias. */
export function pickStackerCaseIndex(bank, remainingIndices, excludeIdx = -1) {
  if (!remainingIndices?.length) return null;
  const pool = remainingIndices.filter((i) => i !== excludeIdx);
  if (!pool.length) return pickUniform(remainingIndices);
  return pickBiasedFromIndices(bank, pool) ?? pickUniform(pool);
}
