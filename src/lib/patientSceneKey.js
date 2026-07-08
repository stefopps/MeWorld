import { resolvePatientSex } from './patientSex.js';
import { resolvePatientDemographics } from './patientFactsFromHpi.js';
import { resolvePediatricPortraitRef } from './patientPediatricRefs.js';

/** Scene template key: male | female | pedMale | pedFemale */
export function resolvePatientSceneKey(caseData = {}) {
  const sex = resolvePatientSex(caseData);
  const pedRef = resolvePediatricPortraitRef(caseData?.id, caseData);
  const { isPediatric } = resolvePatientDemographics(caseData);
  const pediatric = Boolean(isPediatric || pedRef?.isPediatric);
  if (pediatric) return sex === 'female' ? 'pedFemale' : 'pedMale';
  return sex === 'female' ? 'female' : 'male';
}
