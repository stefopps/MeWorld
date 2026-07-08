import { readAudienceProfile } from './audienceProfile.js';
import { toTitleCase } from './clinicalTextFormat.js';
import { resolvePracticeHpi } from './practiceHpi.js';

/** Default ON — spoiler-free study until case completes. Toggle in Welcome → Settings. */
export function isLearningMode(profile = readAudienceProfile()) {
  return profile?.learningMode !== false;
}

/** CCS / Uber catalog numbers — teach mode, exam mode, or dev build (for case editing). */
export function shouldShowCaseIds({ teachMeMode = false } = {}) {
  if (import.meta.env?.DEV) return true;
  return !isLearningMode() || Boolean(teachMeMode);
}

/** Strip domain / diagnosis spoilers from uber composite titles. */
function stripUberTitleTail(tail) {
  return String(tail || '')
    .replace(/\s*&\s*(ID|AMS|GU|MSK|NEURO|GI|OB\/GYN|CARDIOPULMONARY)\b/gi, '')
    .replace(/\b(MSK|NEURO|GI|GU|OB\/GYN|CARDIOPULMONARY)\s+/gi, '')
    .replace(/\s*(Marathon|Acute|Overlap|Alcohol Withdrawal|Withdrawal)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Learner-facing title — short catalog title (e.g. Ear Pain, Oral Bleeding). */
export function learnerFacingCaseTitle(caseData, { teachMeMode = false } = {}) {
  const raw = String(caseData?.title || '').trim();
  if (!raw) return '';
  if (!isLearningMode() || teachMeMode) return toTitleCase(raw);

  const uber = caseData?.uberMeta;
  if (uber?.patientName) {
    return String(uber.patientName).trim();
  }

  return toTitleCase(raw);
}

/** Presentation intro fallback — same short title in learning mode. */
export function learnerPresentationTitle(caseData) {
  return learnerFacingCaseTitle(caseData);
}

export function learnerPresentationFooter(caseData) {
  const uber = caseData?.uberMeta;
  if (uber?.patientName) {
    const first = String(uber.patientName).split(/\s+/)[0];
    return `${first} — emergency presentation`;
  }
  const synopsis = learnerFacingCaseTitle(caseData);
  if (synopsis) return `${synopsis} — emergency presentation`;
  return 'Emergency presentation';
}

export function formatCaseIdLabel(caseData, { teachMeMode = false } = {}) {
  if (!shouldShowCaseIds({ teachMeMode })) return null;
  const id = caseData?.ccsNumber ?? caseData?.id;
  return id != null && String(id).trim() ? String(id) : null;
}

export function sanitizeCaseForLearning(caseData = {}) {
  if (!caseData || typeof caseData !== 'object') return caseData;
  const cleanHpi =
    resolvePracticeHpi(
      { practice_hpi: caseData.practice_hpi },
      caseData,
      caseData.historyText || '',
    ) || '';
  const out = { ...caseData };
  delete out.diagnosis;
  delete out.case_summary;
  delete out.clinical_tip;
  delete out.objective;
  delete out.hpi_narrative;
  delete out.clinical_hpi_narrative;
  if (out.uberMeta) {
    const { segments, memberCaseIds, domains, briefingNote, ...uberRest } = out.uberMeta;
    out.uberMeta = { ...uberRest };
  }
  if (out.patient_voice && cleanHpi) {
    out.patient_voice = {
      ...out.patient_voice,
      history: cleanHpi.slice(0, 800),
    };
  }
  if (Array.isArray(out.interventions)) {
    out.interventions = out.interventions.map(({ why, ...rest }) => rest);
  }
  return out;
}
