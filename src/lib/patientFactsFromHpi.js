import { getPreparedCase } from './caseNarrative.js';
import { resolvePatientName } from './patientName.js';
import { resolvePatientSex } from './patientSex.js';

const CHILD_VOICE_RE =
  /\b(?:my parents?|my mom|my dad|my mummy|my mommy|my daddy|mommy|daddy|at school|in my class|my teacher)\b/i;
const ADULT_CONTEXT_RE =
  /\b(?:my wife|my husband|retired|pack[-\s]?years?|smok(?:es|ing|ed)\s+for\s+\d+\s+years?)\b/i;

function voiceLines(caseData = {}) {
  const prepared = getPreparedCase(caseData?.id);
  const pv =
    caseData.patient_voice ||
    caseData.patientVoice ||
    prepared?.patient_voice ||
    null;
  if (!pv || typeof pv !== 'object') return '';
  return Object.values(pv)
    .filter((v) => typeof v === 'string' && v.trim())
    .join(' ');
}

export function demographicsCorpus(caseData = {}, persona = null) {
  const prepared = getPreparedCase(caseData?.id);
  const hpi =
    caseData.clinical_hpi_narrative ||
    caseData.hpi_narrative ||
    caseData.historyText ||
    prepared?.hpi_narrative ||
    '';
  const parts = [
    hpi,
    caseData.historyText,
    voiceLines(caseData),
    caseData.chief_complaint,
    caseData.title,
    caseData.diagnosis,
    prepared?.diagnosis,
    caseData.category,
    caseData.objective,
    caseData.clinical_tip,
    persona?.summary,
    persona?.appearance,
  ];
  return parts
    .filter((p) => typeof p === 'string' && p.trim())
    .join('\n');
}

/** Parse explicit age from chart text, portrait persona, or voice. */
export function parseAgeFromText(text = '') {
  const t = String(text || '');
  const monthAge = t.match(/(\d{1,2})[-\s]?month[-\s]?old/i);
  if (monthAge) {
    return { age: Number(monthAge[1]), ageUnit: 'months', ageSource: 'text_months' };
  }

  const patterns = [
    /(\d{1,2})[-\s]?year[-\s]?old/i,
    /\baged?\s+(\d{1,2})\b/i,
    /\b(\d{1,2})[-\s]?yo\b/i,
    /\b(\d{1,2})\s*y\.?o\.?\b/i,
    /\b(\d{1,2})[-\s]?year[-\s]?old\s+(?:male|female|man|woman|boy|girl|child)\b/i,
    /\b(?:approximately|about|around)\s+(\d{1,2})\s+years?\s+old\b/i,
    /\b(\d{1,2})[-\s]?year[-\s]?old\s+(?:male|female|patient|child)\b/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) {
      const age = Number(m[1]);
      if (Number.isFinite(age) && age > 0 && age < 120) {
        return { age, ageUnit: 'years', ageSource: 'text_years' };
      }
    }
  }

  return { age: null, ageUnit: 'years', ageSource: null };
}

function isPediatricCase(caseData = {}, text = '', parsedAge = null) {
  if (parsedAge?.ageUnit === 'months') return true;
  if (parsedAge?.age != null && parsedAge.age < 18) return true;
  if (/pediatrics?|peds\b/i.test(String(caseData.category || ''))) return true;
  if (CHILD_VOICE_RE.test(text)) return true;
  if (/\b(?:pediatric\s+patient|school[-\s]?age|preteen|toddler|infant|newborn)\b/i.test(text)) {
    return true;
  }
  if (
    /\b(?:young\s+(?:boy|girl|child)|child(?:ren)?\s+with|boy\s+with|girl\s+with)\b/i.test(text) &&
    !ADULT_CONTEXT_RE.test(text)
  ) {
    return true;
  }
  return false;
}

function defaultPediatricAge(text = '') {
  if (/\b(?:newborn|neonate|infant)\b/i.test(text)) return { age: 8, ageUnit: 'months' };
  if (/\b(?:toddler)\b/i.test(text)) return { age: 2, ageUnit: 'years' };
  if (/\b(?:adolescent|teen(?:ager)?)\b/i.test(text)) return { age: 14, ageUnit: 'years' };
  if (/\bscoliosis\b/i.test(text)) return { age: 6, ageUnit: 'years' };
  return { age: 7, ageUnit: 'years' };
}

import { applyPediatricPortraitRef } from './patientPediatricRefs.js';

/** Ground-truth age band for patient_sim — category, voice, portrait, and HPI. */
export function resolvePatientDemographics(caseData = {}, persona = null) {
  const corpus = demographicsCorpus(caseData, persona);
  const parsed = parseAgeFromText(corpus);
  let age = parsed.age;
  let ageUnit = parsed.ageUnit || 'years';
  let ageSource = parsed.ageSource;

  if (age == null && persona?.estimatedAgeYears != null) {
    const yrs = Number(persona.estimatedAgeYears);
    if (Number.isFinite(yrs) && yrs > 0 && yrs < 1) {
      age = Math.max(1, Math.round(yrs * 12));
      ageUnit = 'months';
      ageSource = 'portrait_vision';
    } else if (Number.isFinite(yrs) && yrs >= 1 && yrs < 120) {
      age = Math.round(yrs);
      ageUnit = 'years';
      ageSource = 'portrait_vision';
    }
  }

  const pediatric = isPediatricCase(caseData, corpus, { age, ageUnit, ageSource });

  if (age == null && pediatric) {
    const inferred = defaultPediatricAge(corpus);
    age = inferred.age;
    ageUnit = inferred.ageUnit;
    ageSource = 'inferred_pediatric';
  }

  const ageLabel =
    age == null
      ? null
      : ageUnit === 'months'
        ? `${age} months old`
        : `${age} years old`;

  const base = {
    age,
    ageUnit,
    ageLabel,
    ageSource,
    isPediatric: pediatric,
    speakAsChild: pediatric && (age == null || age < 13),
    parentMayBePresent: CHILD_VOICE_RE.test(corpus) || pediatric,
    category: caseData.category || null,
  };
  return applyPediatricPortraitRef(base, caseData?.id ?? caseData?.ccsNumber, caseData);
}

/** Pull interview-ready facts from HPI / history text for patient simulation. */
export function extractPatientFacts(caseData = {}, persona = null) {
  const corpus = demographicsCorpus(caseData, persona);
  const demographics = resolvePatientDemographics(caseData, persona);
  const vitals = caseData.vitals || {};

  const facts = {
    name: resolvePatientName(caseData) || null,
    sex: resolvePatientSex(caseData),
    age: demographics.age,
    ageUnit: demographics.ageUnit,
    ageLabel: demographics.ageLabel,
    ageSource: demographics.ageSource,
    isPediatric: demographics.isPediatric,
    speakAsChild: demographics.speakAsChild,
    parentMayBePresent: demographics.parentMayBePresent,
    travel: null,
    smoking: null,
    cough: null,
    fever: null,
    chiefComplaint: caseData.chief_complaint || caseData.title || null,
    spo2: vitals.spo2 != null ? vitals.spo2 : null,
    heartRate: vitals.hr != null ? vitals.hr : null,
    respiratoryRate: vitals.rr != null ? vitals.rr : null,
    temperature: vitals.temp != null ? vitals.temp : null,
  };

  if (/denies?\s+(?:any\s+)?(?:recent\s+)?travel/i.test(corpus)) {
    facts.travel = 'No recent travel';
  } else if (/(?:recent\s+travel|traveled\s+to|travelled\s+to|returned\s+from|trip\s+to)/i.test(corpus)) {
    const m = corpus.match(
      /(?:traveled\s+to|travelled\s+to|returned\s+from|trip\s+to|recent\s+travel\s+to)\s+([^.,;\n]{3,48})/i,
    );
    facts.travel = m ? m[1].trim() : 'Recent travel mentioned in history';
  } else if (/no\s+recent\s+travel/i.test(corpus)) {
    facts.travel = 'No recent travel';
  }

  if (demographics.isPediatric || demographics.speakAsChild) {
    facts.smoking = 'Never smoker (child)';
  } else if (/never\s+smok|non[-\s]?smok|denies?\s+smok/i.test(corpus)) {
    facts.smoking = 'Never smoker';
  } else if (/(?:pack[-\s]?years?|cigarette|tobacco|smok(?:es|ing|ed|er))/i.test(corpus)) {
    const m = corpus.match(
      /(?:smok(?:es|ing|ed|er)[^.;\n]{0,60}|pack[-\s]?years?[^.;\n]{0,40})/i,
    );
    facts.smoking = m ? m[0].trim().slice(0, 100) : 'Smoking history documented';
  }

  if (/(?:productive\s+)?cough/i.test(corpus)) {
    const m = corpus.match(/cough[^.;\n]{0,80}/i);
    facts.cough = m ? m[0].trim() : 'Cough';
  }
  if (/fever|febrile|temperature/i.test(corpus)) {
    const m = corpus.match(/(?:fever|febrile)[^.;\n]{0,60}/i);
    facts.fever = m ? m[0].trim() : 'Fever reported';
  }

  return facts;
}

export function hpiExcerpt(caseData = {}, maxLen = 2800) {
  const prepared = getPreparedCase(caseData?.id);
  const raw =
    caseData.clinical_hpi_narrative ||
    caseData.hpi_narrative ||
    caseData.historyText ||
    prepared?.hpi_narrative ||
    '';
  const voice = voiceLines(caseData);
  const text = [String(raw).trim(), voice].filter(Boolean).join('\n');
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}
