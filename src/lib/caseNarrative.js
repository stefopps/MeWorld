import preparedCases from '../data/preparedCases.json' with { type: 'json' };
import { getCompletionThresholdAdjust } from './sessionProfile.js';
import { getActiveRefinedNarrative } from './narrativeRefine.js';
import { composeCaseHistory, resolveCaseExam } from './caseExam.js';
import { applyPatientName, applyPatientNameToCase, getDefaultPatientName, resolvePatientName } from './patientName.js';
import { hpiContainsSpoilers, resolveAnswerKeyHpi, resolvePracticeHpi } from './practiceHpi.js';
import { resolvePatientSex } from './patientSex.js';

const PREPARED = preparedCases?.cases || {};

export function getPreparedCase(caseId) {
  const key = String(caseId || '').padStart(3, '0');
  return PREPARED[key] || null;
}

export function applySessionToCase(caseData, session = {}) {
  const playRole = session.playRole === 'patient' ? 'patient' : 'doctor';
  const difficulty = ['easy', 'standard', 'hard'].includes(session.difficulty)
    ? session.difficulty
    : 'standard';
  const prepared = getPreparedCase(caseData?.id);
  const uberAnchorId =
    !prepared?.vitals && caseData?.uberMeta?.memberCaseIds?.[0]
      ? String(caseData.uberMeta.memberCaseIds[0]).padStart(3, '0')
      : null;
  const anchorPrepared = uberAnchorId ? getPreparedCase(uberAnchorId) : null;
  const resolvedVitals = prepared?.vitals || anchorPrepared?.vitals || null;
  const narr = prepared?.narrative?.[playRole]?.[difficulty];

  const merged = {
    ...caseData,
    playRole,
    sessionDifficulty: difficulty,
    preparedVitals: resolvedVitals,
    preparedExam: prepared?.exam || null,
    flowTrack: prepared?.flowTrack || caseData.flowTrack,
    dispositionUnits: prepared?.dispositionUnits || caseData.dispositionUnits,
  };

  const clinicalHpi = resolveAnswerKeyHpi(prepared, caseData);
  merged.clinical_hpi_narrative = clinicalHpi;

  if (narr) {
    const introStub = narr.intro && /— emergency presentation/i.test(narr.intro);
    if (narr.intro && !(caseData?.uberMeta && introStub)) {
      merged.chief_complaint = narr.intro.slice(0, 800);
    }
    if (narr.vitalsText != null) merged.vitalsText = narr.vitalsText;
    if (narr.clinicalTip) merged.clinical_tip = narr.clinicalTip;
    if (narr.objective) merged.objective = narr.objective;
  }

  const refined = getActiveRefinedNarrative(caseData?.id, playRole, difficulty);
  if (refined) {
    if (refined.intro) merged.chief_complaint = refined.intro.slice(0, 800);
    if (refined.vitalsText != null) merged.vitalsText = refined.vitalsText;
    if (refined.clinicalTip) merged.clinical_tip = refined.clinicalTip;
    if (refined.objective) merged.objective = refined.objective;
    merged.narrativeSource = refined.label || 'refined';
  }

  const introForSex = narr?.intro || merged.chief_complaint || '';
  merged.patientSex = resolvePatientSex({
    ...merged,
    chief_complaint: introForSex,
    preparedIntro: narr?.intro || prepared?.narrative?.doctor?.standard?.intro || '',
    patientSex: prepared?.patientSex || caseData?.patientSex,
  });
  if (prepared?.uberFaceSlug) {
    merged.uberFaceSlug = prepared.uberFaceSlug;
  }
  if (prepared?.portraitNote) {
    merged.portraitNote = prepared.portraitNote;
  }

  if (prepared?.interventions?.length) {
    const uberMergedStacks =
      caseData?.uberMeta &&
      Array.isArray(caseData.interventions) &&
      caseData.interventions.length > prepared.interventions.length;
    if (!uberMergedStacks) {
      merged.interventions = prepared.interventions;
    }
  }
  if (prepared?.decoys?.length && !caseData?.uberMeta) {
    merged.decoys = prepared.decoys;
  } else if (caseData?.decoys?.length) {
    merged.decoys = caseData.decoys;
  }
  if (prepared?.diagnosis) {
    merged.diagnosis = prepared.diagnosis;
  }
  if (prepared?.case_summary?.trim()) {
    merged.case_summary = prepared.case_summary.trim();
  }
  if (prepared?.caseBankSource) {
    merged.caseBankSource = prepared.caseBankSource;
  }
  if (prepared?.exam?.length) {
    merged.preparedExam = prepared.exam;
  }

  const patientVoice =
    caseData?.patient_voice || caseData?.patientVoice || prepared?.patient_voice || null;
  const composedHistory = composeCaseHistory({
    history: merged.historyText || resolvePracticeHpi(prepared, caseData) || '',
    patientVoice,
    clinicalHpi: merged.clinical_hpi_narrative || resolveAnswerKeyHpi(prepared, caseData) || '',
    chiefComplaint: merged.chief_complaint || '',
  });
  merged.preparedExam = resolveCaseExam({
    caseId: caseData?.id,
    title: prepared?.title || caseData?.title,
    category: prepared?.category || caseData?.category,
    diagnosis: merged.diagnosis || prepared?.diagnosis || caseData?.diagnosis || '',
    history: composedHistory,
    vitals: resolvedVitals || {},
    patientVoice,
    preparedExam: merged.preparedExam,
    hasSourceIntro: prepared?.hasSourceIntro || caseData?.preparedMeta?.hasSourceIntro,
  });

  merged.completionThreshold = getCompletionThresholdAdjust(
    difficulty,
    caseData.completionThreshold ?? 99,
  );

  const caseNum = caseData?.ccsNumber ?? Number(caseData?.id) ?? 0;
  merged.patient_name_default =
    prepared?.patient_name_default ||
    caseData?.patient_name_default ||
    getDefaultPatientName(caseNum, merged.patientSex || prepared?.patientSex);
  const displayName = resolvePatientName(merged);
  const namedClinical = applyPatientName(clinicalHpi, displayName);
  merged.hpi_narrative = namedClinical;
  const practiceHistoryRaw = resolvePracticeHpi(prepared, caseData);
  merged.historyText = practiceHistoryRaw
    ? applyPatientName(practiceHistoryRaw, displayName)
    : '';
  merged.chief_complaint = applyPatientName(merged.chief_complaint || '', displayName);
  return { ...merged, patientDisplayName: displayName };
}
