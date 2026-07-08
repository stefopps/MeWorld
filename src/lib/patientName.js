import {
  getActiveNameRegion,
  getNameRegionLabel,
  getNamesForRegion,
  MIXED_SOURCE_REGIONS,
  normalizeNameRegion,
} from './patientNameRegions.js';

function inferSexFromPatient(patient = '') {
  const p = String(patient).toLowerCase();
  if (/\bfemale\b|\bwoman\b|\belderly woman\b/.test(p)) return 'female';
  if (/\bmale\b|\bman\b/.test(p)) return 'male';
  return 'unknown';
}

/** Pick name from regional bank (Settings → patient name region). */
export function getDefaultPatientName(caseNum, sexHint = 'unknown', regionId) {
  const num = Number(caseNum) || 1;
  const region = normalizeNameRegion(regionId || getActiveNameRegion());

  // NYC-style mix: each case # maps to a different regional pool (stable per case).
  if (region === 'mixed') {
    const source = MIXED_SOURCE_REGIONS[(num - 1) % MIXED_SOURCE_REGIONS.length];
    return getDefaultPatientName(num, sexHint, source);
  }

  const list = getNamesForRegion(region);
  if (!list.length) return sexHint === 'female' ? 'Mrs. Patient' : 'Mr. Patient';
  let pool = list;
  if (sexHint === 'female') pool = list.filter((n) => n.sex === 'female');
  if (sexHint === 'male') pool = list.filter((n) => n.sex === 'male');
  if (!pool.length) pool = list;

  return pool[(num - 1) % pool.length]?.display || list[0]?.display || 'Mrs. Patient';
}

export function resolvePatientName(caseData) {
  if (!caseData) return '';
  if (caseData.patientDisplayName) return caseData.patientDisplayName;
  if (caseData.patient_name) return caseData.patient_name;
  const locked = String(caseData.patient_name_default || '').trim();
  if (locked) return locked;

  const caseNum = caseData.ccsNumber ?? Number(caseData.id) ?? 0;
  const sex = caseData.patientSex || inferSexFromPatient(caseData?.patient);
  const region = normalizeNameRegion(caseData.nameRegion || getActiveNameRegion());
  return getDefaultPatientName(caseNum, sex, region);
}

export function getActiveNameRegionLabel() {
  return getNameRegionLabel(getActiveNameRegion());
}

const NAME_PLACEHOLDERS = [
  /\{\{patient_name\}\}/gi,
  /\{\{patient\}\}/gi,
  /\[Patient Name\]/gi,
  /\[patient name\]/gi,
  /\bMs\.?\s*X\b/gi,
  /\bMr\.?\s*X\b/gi,
];

export function applyPatientName(text, displayName) {
  if (!text || !displayName) return text || '';
  let result = String(text);
  for (const regex of NAME_PLACEHOLDERS) {
    result = result.replace(regex, displayName);
  }
  return result;
}

export function applyPatientNameToCase(caseData) {
  if (!caseData) return caseData;
  const name = resolvePatientName(caseData);
  if (!name) return caseData;

  const fields = [
    'chief_complaint',
    'historyText',
    'hpi_narrative',
    'clinical_hpi_narrative',
    'vitalsText',
    'clinical_tip',
    'objective',
    'diagnosis',
  ];

  const updated = { ...caseData, patientDisplayName: name };
  for (const field of fields) {
    if (typeof updated[field] === 'string') {
      updated[field] = applyPatientName(updated[field], name);
    }
  }
  return updated;
}
