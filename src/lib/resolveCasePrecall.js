import { getUberCaseExtension } from './uberCases.js';

/** Shipped pre-hospital / pre-call cinematic before briefing (Uber cases). */
export function resolveCasePrecall(caseData = {}) {
  const id = String(caseData?.id ?? '').trim().toUpperCase();
  const ext = getUberCaseExtension(id);
  const videoUrl = caseData?.precallVideo || ext?.precallVideo;
  if (!videoUrl?.trim()) return null;

  return {
    caseId: id,
    videoUrl: videoUrl.trim(),
    posterUrl: (caseData?.precallPoster || ext?.precallPoster || '').trim() || null,
    title: caseData?.precallTitle || ext?.precallTitle || 'Pre-hospital',
    durationSec: Math.max(3, Number(caseData?.precallDurationSec || ext?.precallDurationSec) || 6),
  };
}

const PRECALL_SKIP_KEY = 'meworld-case-precall-skip';

export function shouldSkipCasePrecall(caseId) {
  if (!caseId) return false;
  try {
    return sessionStorage.getItem(`${PRECALL_SKIP_KEY}:${String(caseId).toUpperCase()}`) === '1';
  } catch {
    return false;
  }
}

export function markCasePrecallSkipped(caseId) {
  if (!caseId) return;
  try {
    sessionStorage.setItem(`${PRECALL_SKIP_KEY}:${String(caseId).toUpperCase()}`, '1');
  } catch {
    /* ignore */
  }
}

export function clearCasePrecallSkip(caseId) {
  if (!caseId) return;
  try {
    sessionStorage.removeItem(`${PRECALL_SKIP_KEY}:${String(caseId).toUpperCase()}`);
  } catch {
    /* ignore */
  }
}
