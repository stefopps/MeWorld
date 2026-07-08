import {
  formatClinicalText,
  pickBestHistory,
} from './clinicalTextFormat.js';
import { getActiveRefinedNarrative } from './narrativeRefine.js';
import { readAudienceProfile } from './audienceProfile.js';
import { isLearningMode, learnerPresentationTitle } from './learningMode.js';
import { hpiContainsSpoilers, isPlaceholderPresentation } from './practiceHpi.js';

/** Whether this case has imported CCS narrative vs a placeholder stub. */
export function hasRichPresentation(caseData) {
  if (caseData?.preparedMeta?.hasSourceIntro) return true;
  const history = caseData?.historyText || '';
  if (history.length < 120) return false;
  return !/— emergency presentation\.?$/i.test(history.trim());
}

export function getPresentationIntro(caseData) {
  const playRole = caseData?.playRole || readAudienceProfile()?.playRole || 'doctor';
  const difficulty = caseData?.sessionDifficulty || readAudienceProfile()?.difficulty || 'standard';
  const refined = getActiveRefinedNarrative(caseData?.id, playRole, difficulty);
  if (refined?.intro && !/— emergency presentation\.?$/i.test(refined.intro)) {
    return formatClinicalText(refined.intro);
  }
  if (isLearningMode()) {
    return formatClinicalText(
      caseData?.chief_complaint?.trim() || learnerPresentationTitle(caseData) || '',
    );
  }
  return formatClinicalText(caseData?.chief_complaint?.trim() || '');
}

export function getPresentationHistory(caseData) {
  const playRole = caseData?.playRole || readAudienceProfile()?.playRole || 'doctor';
  const difficulty = caseData?.sessionDifficulty || readAudienceProfile()?.difficulty || 'standard';
  const refined = getActiveRefinedNarrative(caseData?.id, playRole, difficulty);
  if (refined?.hpi && !hpiContainsSpoilers(refined.hpi) && !isPlaceholderPresentation(refined.hpi)) {
    return formatClinicalText(refined.hpi);
  }

  const practice = caseData?.practice_hpi?.trim();
  if (practice && !hpiContainsSpoilers(practice) && !isPlaceholderPresentation(practice)) {
    return formatClinicalText(practice);
  }

  const intro = caseData?.chief_complaint?.trim() || '';
  const history = caseData?.historyText?.trim() || '';
  if (history && isPlaceholderPresentation(history)) {
    const text = pickBestHistory({ history: '', intro, playRole, caseId: caseData?.id });
    return formatClinicalText(text || intro);
  }
  const text = pickBestHistory({
    history,
    intro,
    playRole,
    caseId: caseData?.id,
  });
  return formatClinicalText(text);
}

export function getPresentationVitals(caseData) {
  const playRole = caseData?.playRole || readAudienceProfile()?.playRole || 'doctor';
  const difficulty = caseData?.sessionDifficulty || readAudienceProfile()?.difficulty || 'standard';
  const refined = getActiveRefinedNarrative(caseData?.id, playRole, difficulty);
  if (refined?.vitalsText) return formatClinicalText(refined.vitalsText);
  return formatClinicalText(caseData?.vitalsText?.trim() || '');
}
