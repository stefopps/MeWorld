import differentialBank from '../data/differentialBank.json';
import {
  getCaseRecord,
  getFlaggedCaseIds,
  normalizeCaseProgressId,
} from '../data/caseProgress.js';
import { readCaseMemoryMeta } from './differentialCaseMemory.js';
import { readDifferentialLog } from './differentialPracticeLog.js';

const bankByCaseId = new Map(differentialBank.map((entry) => [entry.caseId, entry]));

function resolveBankEntry(caseId) {
  const n = Number.parseInt(String(caseId), 10);
  return bankByCaseId.get(n) || null;
}

function notesForCase(caseId) {
  const notes = readCaseMemoryMeta(caseId);
  return Boolean(notes.text?.trim() || notes.hasImage);
}

/**
 * Bookmarked cases + recent differential practice for the Review tab jump list.
 */
export function buildDifferentialReviewQueue({ recentLimit = 15 } = {}) {
  const bookmarkedIds = new Set();

  const bookmarked = getFlaggedCaseIds().map((progressId) => {
    const caseId = Number.parseInt(progressId, 10);
    bookmarkedIds.add(String(caseId));
    const bank = resolveBankEntry(caseId);
    const rec = getCaseRecord(caseId);
    return {
      caseId,
      progressId,
      topic: bank?.topic || 'Unknown topic',
      diagnosis: bank?.diagnosis || '',
      at: rec?.flaggedAt || null,
      kind: 'bookmark',
      hasNotes: notesForCase(caseId),
    };
  });

  const lastByCase = new Map();
  for (const attempt of readDifferentialLog().attempts) {
    if (attempt.caseId == null) continue;
    const id = String(attempt.caseId);
    const prev = lastByCase.get(id);
    if (!prev || String(attempt.at).localeCompare(String(prev.at)) > 0) {
      lastByCase.set(id, attempt);
    }
  }

  const recent = [...lastByCase.values()]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, recentLimit)
    .map((attempt) => {
      const caseId = attempt.caseId;
      const bank = resolveBankEntry(caseId);
      return {
        caseId,
        progressId: normalizeCaseProgressId(caseId),
        topic: attempt.topic || bank?.topic || 'Unknown topic',
        diagnosis: bank?.diagnosis || '',
        at: attempt.at,
        kind: 'recent',
        bookmarked: bookmarkedIds.has(String(caseId)),
        hasNotes: notesForCase(caseId),
        lastPct: attempt.pct,
        revealed: Boolean(attempt.revealed),
        gotCaseDiagnosis: Boolean(attempt.gotCaseDiagnosis),
      };
    });

  return {
    bookmarked,
    recent,
    bookmarkCount: bookmarked.length,
  };
}
