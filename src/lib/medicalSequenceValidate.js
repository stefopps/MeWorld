import { resolvePatientDemographics } from './patientFactsFromHpi.js';

/** Language that only fits infants/toddlers — must not appear for adults. */
const INFANT_ONLY_CUES =
  /\b(baby|infant|newborn|wet diapers?|diapers?|bottle feed|breastfeed|mom'?s arms|mother'?s arms|in mom|in mother|quieter baby|each feed)\b/i;

const CAREGIVER_CHILD_CUES =
  /\b(mom brings|mother brings|parent brings).{0,40}(baby|infant|child)\b/i;

export function patientAgeYears(demo = {}) {
  if (demo.age == null) return demo.isPediatric ? 7 : 40;
  if (demo.ageUnit === 'months') return demo.age / 12;
  return demo.age;
}

/** Return list of human-readable consistency errors (empty = ok). */
export function validateMedicalSequenceDemographics(sequence, caseData) {
  const errors = [];
  if (!sequence || !caseData) return errors;

  const demo = resolvePatientDemographics(caseData);
  const ageYears = patientAgeYears(demo);
  const isAdult = !demo.isPediatric && ageYears >= 13;

  const allBeats = [
    ...(sequence.prequel || []),
    ...(sequence.missedPath || []),
    ...(sequence.savedPath || []),
  ];

  for (const beat of allBeats) {
    const text = `${beat.title || ''} ${beat.caption || ''} ${beat.visualHint || ''}`;
    if (isAdult && (INFANT_ONLY_CUES.test(text) || CAREGIVER_CHILD_CUES.test(text))) {
      errors.push(
        `Beat "${beat.title}": infant/caregiver-child language for ${demo.ageLabel || 'adult'} patient`,
      );
    }
    if (isAdult && /\bmom\b|\bmother\b/i.test(text) && !/\b(mother with|his mother|patient's mother)\b/i.test(text)) {
      if (/mom's arms|mother's arms|mom brings|mother brings/i.test(text)) {
        errors.push(`Beat "${beat.title}": use spouse/partner/EMS for adult — not "mom's arms"`);
      }
    }
  }

  const lock = String(sequence.patientLock || '');
  if (isAdult && INFANT_ONLY_CUES.test(lock)) {
    errors.push('patientLock contains infant-only language');
  }

  return errors;
}

export function sequenceFailsDemographicsCheck(sequence, caseData) {
  return validateMedicalSequenceDemographics(sequence, caseData).length > 0;
}
