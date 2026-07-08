import { STORAGE } from './storageKeys.js';
import {
  getRecentCaseHistory as getProgressHistory,
  isCaseAttempted,
  normalizeCaseProgressId,
} from '../data/caseProgress.js';
import { caseHasChatActivity, listCasesWithChatActivity } from './recentChatCases.js';

/** Server-touched case ids cached from /api/user/visits (study :3001 vs main :3002). */
export function readServerCoveredCaseIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE.coveredCaseIds));
    return new Set((Array.isArray(raw) ? raw : []).map(normalizeCaseProgressId).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function syncServerCoveredCaseIds(visitRows = []) {
  const set = readServerCoveredCaseIds();
  for (const row of visitRows) {
    const id = normalizeCaseProgressId(row?.caseId);
    if (id) set.add(id);
  }
  try {
    localStorage.setItem(STORAGE.coveredCaseIds, JSON.stringify([...set]));
  } catch {
    /* storage full */
  }
  return set;
}

/**
 * True when the learner has touched this case — progress, chat, or server session.
 * Matches the timeline "cases covered" count (not only localStorage attempted flag).
 */
export function isCaseCovered(caseId) {
  const id = normalizeCaseProgressId(caseId);
  if (!id) return false;
  if (isCaseAttempted(id)) return true;
  if (caseHasChatActivity(id)) return true;
  return readServerCoveredCaseIds().has(id);
}

/** Unique covered case ids — same union as the welcome Timeline total. */
export function buildCoveredCaseIdSet({ serverRows = null } = {}) {
  const byId = new Set();

  for (const row of getProgressHistory({ limit: 10_000 })) {
    const id = normalizeCaseProgressId(row.caseId);
    if (id) byId.add(id);
  }

  for (const row of listCasesWithChatActivity({ limit: 10_000 })) {
    const id = normalizeCaseProgressId(row.caseId);
    if (id) byId.add(id);
  }

  for (const id of readServerCoveredCaseIds()) {
    byId.add(id);
  }

  if (Array.isArray(serverRows)) {
    for (const row of serverRows) {
      const id = normalizeCaseProgressId(row.caseId);
      if (id) byId.add(id);
    }
  }

  return byId;
}

export function countCasesCovered(opts = {}) {
  return buildCoveredCaseIdSet(opts).size;
}
