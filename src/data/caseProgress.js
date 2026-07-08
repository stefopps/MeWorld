import { STORAGE } from '../lib/storageKeys.js';
import { isCaseCovered } from '../lib/caseCoverage.js';
import { getBranding } from './gameData.js';
import { getUberDefinition } from '../lib/uberCases.js';

const STORAGE_KEY = STORAGE.progress;

/** Catalog ids are zero-padded (`065`); differential deck uses bare numbers (`65`). */
export function normalizeCaseProgressId(caseId) {
  const raw = String(caseId ?? '').trim();
  if (!raw) return '';
  return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw;
}

function defaultProgress() {
  return {
    cases: {},
    queue: [],
    queueIndex: 0,
    lastMode: 'browse',
  };
}

export function readProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaultProgress(), ...raw, cases: raw?.cases || {} };
  } catch {
    return defaultProgress();
  }
}

export function writeProgress(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage full */
  }
}

export function getCaseRecord(caseId) {
  const id = normalizeCaseProgressId(caseId);
  return readProgress().cases[id] || null;
}

export function isCaseFlaggedForReview(caseId) {
  return Boolean(getCaseRecord(caseId)?.reviewNext);
}

export function getFlaggedCaseIds() {
  return Object.entries(readProgress().cases)
    .filter(([, rec]) => rec?.reviewNext)
    .sort((a, b) => String(b[1]?.flaggedAt || '').localeCompare(String(a[1]?.flaggedAt || '')))
    .map(([id]) => id);
}

export function getFlaggedReviewCount() {
  return getFlaggedCaseIds().length;
}

// ── Favorites ──

export function isFavorite(caseId) {
  return Boolean(getCaseRecord(caseId)?.favorite);
}

/** Manual study checklist — independent of accuracy-based "mastered". */
export function isCaseStudyDone(caseId) {
  return isCaseAttempted(caseId);
}

/** Learner opened or finished this case — green radio in case lists. */
export function isCaseAttempted(caseId) {
  const rec = getCaseRecord(caseId);
  if (!rec) return false;
  if (rec.attempted === false) return false;
  return Boolean(
    rec.attempted || rec.studyDone || (rec.plays ?? 0) > 0 || rec.lastVisited,
  );
}

export function markCaseAttempted(caseId, source = 'visit') {
  const id = normalizeCaseProgressId(caseId);
  if (!id) return false;
  const p = readProgress();
  const prev = p.cases[id] || {
    plays: 0,
    bestAccuracy: 0,
    completed: false,
    lastPlayed: null,
  };
  const next = {
    ...prev,
    attempted: true,
    attemptedAt: prev.attemptedAt || new Date().toISOString(),
    attemptedSource: source,
  };
  p.cases[id] = next;
  writeProgress(p);
  return true;
}

export function toggleCaseAttempted(caseId) {
  const id = normalizeCaseProgressId(caseId);
  if (!id) return false;
  const p = readProgress();
  const prev = p.cases[id] || {
    plays: 0,
    bestAccuracy: 0,
    completed: false,
    lastPlayed: null,
  };
  const nextAttempted = isCaseAttempted(id) ? false : true;
  const next = {
    ...prev,
    attempted: nextAttempted,
    attemptedAt: nextAttempted ? new Date().toISOString() : null,
    attemptedSource: nextAttempted ? 'manual' : null,
  };
  p.cases[id] = next;
  writeProgress(p);
  return nextAttempted;
}

export function countAttemptedInIds(ids = []) {
  return ids.filter((rawId) => isCaseAttempted(rawId)).length;
}

/** @deprecated use countAttemptedInIds */
export function countStudyDoneInIds(ids = []) {
  return countAttemptedInIds(ids);
}

export function toggleCaseStudyDone(caseId) {
  return toggleCaseAttempted(caseId);
}

export function toggleFavorite(caseId) {
  const id = normalizeCaseProgressId(caseId);
  if (!id) return false;
  const p = readProgress();
  const prev = p.cases[id] || {
    plays: 0,
    bestAccuracy: 0,
    completed: false,
    lastPlayed: null,
  };
  const next = {
    ...prev,
    favorite: !prev.favorite,
    favoritedAt: !prev.favorite ? new Date().toISOString() : null,
  };
  p.cases[id] = next;
  writeProgress(p);
  return next.favorite;
}

export function getFavoriteCaseIds() {
  return Object.entries(readProgress().cases)
    .filter(([, rec]) => rec?.favorite)
    .sort((a, b) => String(b[1]?.favoritedAt || '').localeCompare(String(a[1]?.favoritedAt || '')))
    .map(([id]) => id);
}

export function getFavoriteCount() {
  return getFavoriteCaseIds().length;
}

export function setCaseReviewFlag(caseId, flagged) {
  const id = normalizeCaseProgressId(caseId);
  if (!id) return false;
  const p = readProgress();
  const prev = p.cases[id] || {
    plays: 0,
    bestAccuracy: 0,
    completed: false,
    lastPlayed: null,
  };
  const next = {
    ...prev,
    reviewNext: Boolean(flagged),
    flaggedAt: flagged ? new Date().toISOString() : null,
  };
  p.cases[id] = next;
  writeProgress(p);
  return next.reviewNext;
}

export function toggleCaseReviewFlag(caseId) {
  return setCaseReviewFlag(caseId, !isCaseFlaggedForReview(caseId));
}

/** Leave case unfinished — bookmark for review and do not mark completed. */
export function markCaseIncomplete(caseId) {
  const id = normalizeCaseProgressId(caseId);
  if (!id) return;
  setCaseReviewFlag(id, true);
  const p = readProgress();
  const prev = p.cases[id] || {
    plays: 0,
    bestAccuracy: 0,
    completed: false,
    lastPlayed: null,
  };
  p.cases[id] = {
    ...prev,
    completed: false,
    incomplete: true,
    skippedAt: new Date().toISOString(),
    lastPlayed: new Date().toISOString(),
  };
  writeProgress(p);
}

export function recordCaseComplete(caseId, { accuracy, attempts, seconds }) {
  const id = normalizeCaseProgressId(caseId);
  if (!id) return null;
  const p = readProgress();
  const prev = p.cases[id] || {
    plays: 0,
    bestAccuracy: 0,
    completed: false,
    lastPlayed: null,
  };
  const next = {
    ...prev,
    plays: prev.plays + 1,
    bestAccuracy: Math.max(prev.bestAccuracy, accuracy),
    completed: prev.completed || accuracy >= (getBranding()?.completionThreshold ?? 99),
    lastPlayed: new Date().toISOString(),
    lastAttempts: attempts,
    lastSeconds: seconds,
    attempted: true,
    attemptedAt: prev.attemptedAt || new Date().toISOString(),
    attemptedSource: prev.attemptedSource || 'complete',
  };
  p.cases[id] = next;
  writeProgress(p);
  return next;
}

export function getCompletionStats(totalCases) {
  const p = readProgress();
  const completed = Object.values(p.cases).filter((c) => c.completed).length;
  const played = Object.keys(p.cases).length;
  return {
    completed,
    played,
    total: totalCases,
    pct: totalCases ? Math.round((completed / totalCases) * 100) : 0,
  };
}

export function shuffleIds(ids) {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickRandomId(ids) {
  if (!ids.length) return null;
  return ids[Math.floor(Math.random() * ids.length)];
}

/**
 * Shuffle pick — prefer cases not on the learner's covered timeline yet.
 * Repeats only when every candidate in the pool was already touched.
 */
export function pickShuffleCaseId(ids, { excludeId = null, preferUnattempted = true } = {}) {
  const normalized = [...new Set(ids.map((id) => normalizeCaseProgressId(id)).filter(Boolean))];
  if (!normalized.length) return null;

  let pool = excludeId
    ? normalized.filter((id) => id !== normalizeCaseProgressId(excludeId))
    : normalized;
  if (!pool.length) pool = normalized;

  if (preferUnattempted) {
    const fresh = pool.filter((id) => !isCaseCovered(id));
    if (fresh.length) pool = fresh;
  }

  return pickRandomId(pool);
}

/** Start or restart full-library shuffle queue. Returns first case id. */
export function startShuffleQueue(allIds, { preferUnattempted = true } = {}) {
  const normalized = [...new Set(allIds.map((id) => normalizeCaseProgressId(id)).filter(Boolean))];
  let pool = normalized;
  if (preferUnattempted) {
    const fresh = pool.filter((id) => !isCaseCovered(id));
    if (fresh.length) pool = fresh;
  }
  const p = readProgress();
  p.queue = shuffleIds(pool);
  p.queueIndex = 0;
  p.lastMode = 'shuffle';
  writeProgress(p);
  return p.queue[0] || null;
}

/** Next id in shuffle queue — skips cases already on the covered timeline. */
export function nextInQueue() {
  const p = readProgress();
  if (!p.queue.length) return null;

  const len = p.queue.length;
  for (let step = 0; step < len; step += 1) {
    p.queueIndex = (p.queueIndex + 1) % p.queue.length;
    const id = p.queue[p.queueIndex];
    if (!isCaseCovered(id)) {
      writeProgress(p);
      return id;
    }
  }

  writeProgress(p);
  return null;
}

export function currentQueueId() {
  const p = readProgress();
  if (!p.queue.length) return null;
  return p.queue[p.queueIndex];
}

export function setLastMode(mode) {
  const p = readProgress();
  p.lastMode = mode;
  writeProgress(p);
}

export function clearProgress() {
  writeProgress(defaultProgress());
}

/** Wipe case progress and saved SOAP drafts for a full restart. */
export function restartCaseProgress() {
  clearProgress();
  if (typeof window === 'undefined') return;
  try {
    const soapPrefix = `${STORAGE.soapDraft}_`;
    const remove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(soapPrefix)) remove.push(key);
    }
    remove.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

/** Most recently played case id, if any. */
export function getLastPlayedCaseId() {
  const p = readProgress();
  let bestId = null;
  let bestTime = 0;
  for (const [id, rec] of Object.entries(p.cases)) {
    const stamp = rec?.lastVisited || rec?.lastPlayed;
    if (!stamp) continue;
    const t = new Date(stamp).getTime();
    if (t > bestTime) {
      bestTime = t;
      bestId = id;
    }
  }
  return bestId;
}

/** Record that the learner opened this case (briefing, play, or browse). */
export function touchCaseVisited(caseId, source = 'play') {
  const id = normalizeCaseProgressId(caseId);
  if (!id) return;
  const p = readProgress();
  const prev = p.cases[id] || {
    plays: 0,
    bestAccuracy: 0,
    completed: false,
    lastPlayed: null,
  };
  p.cases[id] = {
    ...prev,
    lastVisited: new Date().toISOString(),
    lastVisitSource: source,
    attempted: true,
    attemptedAt: prev.attemptedAt || new Date().toISOString(),
    attemptedSource: prev.attemptedSource || source,
  };
  writeProgress(p);

  const uber = getUberDefinition(id);
  if (uber?.memberCaseIds?.length) {
    for (const memberId of uber.memberCaseIds) {
      markCaseAttempted(memberId, `uber:${id}`);
    }
  }
}

/** Cases touched or chatted, most recent first (for History / resume lists). */
export function getRecentCaseHistory({ limit = 30 } = {}) {
  const byId = new Map();
  for (const [caseId, rec] of Object.entries(readProgress().cases)) {
    const at = rec?.lastVisited || rec?.lastPlayed || null;
    if (!at) continue;
    byId.set(caseId, {
      caseId,
      at,
      completed: Boolean(rec.completed),
      plays: rec.plays || 0,
      chatMessages: 0,
      source: rec.lastVisitSource || 'play',
    });
  }
  return [...byId.values()]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

/** Attempted cases in visit order (most recent first) — for Continue / The Whys menus. */
export function getAttemptedCaseHistory({ limit = 40 } = {}) {
  const rows = [];
  for (const [caseId, rec] of Object.entries(readProgress().cases)) {
    if (!isCaseAttempted(caseId)) continue;
    const at = rec?.attemptedAt || rec?.lastVisited || rec?.lastPlayed || null;
    if (!at) continue;
    rows.push({
      caseId,
      at,
      completed: Boolean(rec.completed),
      plays: rec.plays || 0,
      hasCheckpoint: false,
      source: rec.attemptedSource || rec.lastVisitSource || 'visit',
    });
  }
  return rows
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}
