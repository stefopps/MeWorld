import reviewBank from '../data/differentialReview.json' with { type: 'json' };
import { readAudienceProfile } from './audienceProfile.js';
import { getActiveRefinedNarrative } from './narrativeRefine.js';
import { applyPatientName, resolvePatientName } from './patientName.js';

function caseKey(caseId) {
  const n = parseInt(String(caseId ?? ''), 10);
  if (!Number.isFinite(n)) return null;
  return String(n);
}

/** CCS case reference for differential study (built from MeWorld/data/cases/case_N.json). */
export function getDifferentialReview(caseId) {
  const key = caseKey(caseId);
  if (!key) return null;
  return reviewBank?.cases?.[key] || null;
}

export function hasDifferentialReview(caseId) {
  const row = getDifferentialReview(caseId);
  return Boolean(row?.hasReview);
}

function sexHint(review, caseContext) {
  const sex = caseContext.patientSex || review?.patientSex;
  if (sex === 'female' || sex === 'male') return sex;
  return '';
}

/** Apply Settings name region + optional refined HPI to review text. */
export function personalizeDifferentialReview(review, caseContext = {}) {
  if (!review) return null;

  const profile = readAudienceProfile();
  const caseId = caseContext.id ?? review.caseId;
  const playRole = caseContext.playRole || profile?.playRole || 'doctor';
  const difficulty = caseContext.difficulty || profile?.difficulty || 'standard';

  const name = resolvePatientName({
    id: caseId,
    ccsNumber: caseContext.ccsNumber ?? caseId,
    patientDisplayName: caseContext.patientDisplayName,
    patientSex: sexHint(review, caseContext),
    nameRegion: profile?.nameRegion,
  });

  const apply = (text) => (text ? applyPatientName(String(text), name) : text);

  const refined = getActiveRefinedNarrative(caseId, playRole, difficulty);
  let history = review.history;
  let hpiNarrative = review.hpiNarrative;
  let caseSummary = review.caseSummary;

  if (refined?.hpi) {
    history = apply(refined.hpi);
    hpiNarrative = history;
    caseSummary = apply(caseSummary);
  } else {
    history = apply(history);
    hpiNarrative = apply(hpiNarrative);
    caseSummary = apply(caseSummary);
  }

  return {
    ...review,
    patientDisplayName: name,
    history,
    hpiNarrative,
    caseSummary,
    orders: (review.orders || []).map((order) => ({
      ...order,
      order: apply(order.order),
      reason: apply(order.reason),
    })),
    ordersText: apply(review.ordersText),
  };
}
