/**
 * Case flow — prefers preparedCases.json (built by scripts/build-prepared-cases.mjs).
 */

import { getPreparedCase } from '../lib/caseNarrative.js';
import { composeCaseHistory, resolveCaseExam } from '../lib/caseExam.js';
import { parseVitalsFromText } from '../lib/vitalsParse.js';
import { clampVitals } from '../lib/vitalsLimits.js';
import { composeClinicalText, resolveClinicalVitals } from '../lib/vitalsClinicalRules.js';

const CASE_FLOW_DICTIONARY = {
  '001': {
    id: '001',
    title: 'Chest Pain',
    flowTrack: 'ACS rapid stratification',
    dispositionUnits: ['ER', 'OBS', 'ICU', 'CATH'],
    vitals: { sbp: 96, dbp: 62, hr: 112, rr: 22, temp: 37.5, spo2: 93, lactate: 2.1 },
  },
  '002': {
    id: '002',
    title: 'Altered Mental Status',
    flowTrack: 'AMS stabilization',
    dispositionUnits: ['ER', 'OBS', 'ICU', 'WARD'],
    vitals: { sbp: 102, dbp: 66, hr: 106, rr: 24, temp: 38.0, spo2: 95, lactate: 2.8 },
  },
  '003': {
    id: '003',
    title: 'Pelvic Pain',
    flowTrack: 'Ectopic exclusion pathway',
    dispositionUnits: ['ER', 'OBS', 'ICU', 'OR'],
    vitals: { sbp: 94, dbp: 58, hr: 118, rr: 23, temp: 37.8, spo2: 96, lactate: 3.1 },
  },
};

export function getCaseFlow(caseData) {
  const key = String(caseData?.id || '').padStart(3, '0');
  const prepared = getPreparedCase(key);
  const authored = CASE_FLOW_DICTIONARY[key];
  const seed = Number(caseData?.ccsNumber) || Number(key) || 0;
  const vitalsSource =
    prepared?.vitalsSource || caseData?.preparedMeta?.vitalsSource || '';
  const baseVitals = clampVitals(
    prepared?.vitals ||
      caseData?.preparedVitals ||
      authored?.vitals ||
      parseVitalsFromText(
        caseData?.vitalsText || prepared?.vitalsText || '',
        caseData?.category || prepared?.category || 'Emergency Medicine',
        seed,
      ),
  );

  const clinicalHpi =
    caseData?.historyText ||
    prepared?.practice_hpi ||
    caseData?.clinical_hpi_narrative ||
    '';
  const patientVoice =
    caseData?.patient_voice || caseData?.patientVoice || prepared?.patient_voice || null;
  const diagnosis = caseData?.diagnosis || prepared?.diagnosis || '';
  const clinicalText = composeClinicalText({
    hpi: clinicalHpi,
    title: caseData?.title || prepared?.title || authored?.title,
    diagnosis,
    chiefComplaint: caseData?.chief_complaint || prepared?.narrative?.doctor?.standard?.intro || '',
    patientVoice,
    exam: caseData?.preparedExam || prepared?.exam,
  });
  const { vitals } = resolveClinicalVitals({
    vitals: baseVitals,
    diagnosis,
    clinicalText,
    seed,
    vitalsSource,
  });

  const history = composeCaseHistory({
    history:
      caseData?.historyText ||
      prepared?.practice_hpi ||
      prepared?.narrative?.doctor?.easy?.hpi ||
      '',
    patientVoice,
    clinicalHpi,
    chiefComplaint: caseData?.chief_complaint || prepared?.narrative?.doctor?.standard?.intro || '',
  });

  const exam = resolveCaseExam({
    caseId: key,
    title: caseData?.title || prepared?.title || authored?.title,
    category: caseData?.category || prepared?.category,
    diagnosis: caseData?.diagnosis || prepared?.diagnosis || '',
    history,
    vitals,
    patientVoice,
    preparedExam: caseData?.preparedExam || prepared?.exam,
    hasSourceIntro: caseData?.preparedMeta?.hasSourceIntro || prepared?.hasSourceIntro,
  });

  if (prepared?.vitals || prepared?.flowTrack) {
    return {
      id: key,
      title: caseData?.title || prepared.title,
      flowTrack: prepared.flowTrack || authored?.flowTrack || 'Standard ED pathway',
      dispositionUnits:
        prepared.dispositionUnits || authored?.dispositionUnits || ['ER', 'OBS', 'ICU', 'WARD'],
      vitals,
      exam,
    };
  }

  if (authored) {
    return { ...authored, vitals, exam };
  }

  return {
    id: key,
    title: caseData?.title || 'Case',
    flowTrack: 'Standard ED pathway',
    dispositionUnits: ['ER', 'OBS', 'ICU', 'WARD'],
    vitals,
    exam,
  };
}

