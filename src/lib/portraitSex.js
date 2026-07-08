import uberRefs from '../data/patientUberRefs.json' with { type: 'json' };
import { resolvePatientSex } from './patientSex.js';

/** Resolve patient sex for portrait / scene template selection. */
export function resolvePortraitSex(caseContext = {}) {
  const facts = caseContext.patientFacts || {};
  const uberSlug = String(caseContext.uberFaceSlug || '').trim();
  if (uberSlug) {
    const entry = uberRefs.refs?.[uberSlug];
    if (entry?.sex === 'female' || entry?.sex === 'male') return entry.sex;
  }

  return resolvePatientSex({
    chief_complaint: caseContext.chief_complaint || facts.chiefComplaint,
    historyText: caseContext.historyText,
    hpi_narrative: caseContext.hpi_narrative,
    clinical_hpi_narrative: caseContext.clinical_hpi_narrative || caseContext.hpiExcerpt,
    patient_voice: caseContext.patient_voice || caseContext.patientVoice,
    title: caseContext.title,
    patientSex: facts.sex || caseContext.patientSex,
    preparedIntro: caseContext.preparedIntro,
    narrativeIntro: caseContext.narrativeIntro,
  });
}
