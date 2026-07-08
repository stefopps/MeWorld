/**
 * Align structured vitals with clinical narrative cues (HPI, diagnosis, exam).
 *
 * Adult BP categories (AHA/ACC 2017, CDC hypertension staging):
 * - Normal:      SBP <120 and DBP <80
 * - Elevated:    SBP 120–129 and DBP <80
 * - Stage 1 HTN: SBP 130–139 or DBP 80–89
 * - Stage 2 HTN: SBP ≥140 or DBP ≥90
 * - Crisis:      SBP >180 or DBP >120
 */

import { clampVitals } from './vitalsLimits.js';

/** Deterministic integer in [min, max] from case seed + slot. */
function seedRange(seed, slot, min, max) {
  const spread = max - min;
  if (spread <= 0) return min;
  return min + ((Number(seed) * 17 + slot * 31) % (spread + 1));
}

/** Deterministic one-decimal temp in [min, max]. */
function seedTemp(seed, slot, min, max) {
  const steps = Math.round((max - min) * 10);
  if (steps <= 0) return min;
  const step = (Number(seed) * 13 + slot * 37) % (steps + 1);
  return Math.round((min + step * 0.1) * 10) / 10;
}

/**
 * Detect hemodynamic / perfusion cues in free text (mirrors scripts/audit-vitals-hpi.mjs).
 * @param {string} text
 */
export function extractClinicalVitalCues(text = '') {
  const t = String(text || '');
  const c = {};
  c.hypertensive =
    /\bhypertens/i.test(t) ||
    /\bhigh blood pressure\b/i.test(t) ||
    /\belevated bp\b/i.test(t) ||
    /\bbp (?:is |was )?(?:1[4-9]\d|2\d\d)\//i.test(t);
  c.hypotensive =
    /\bhypotens/i.test(t) ||
    /\bshock\b/i.test(t) ||
    /\b(?:sbp|bp)[^\d]{0,12}(?:[6-8]\d|9[0-4])\//i.test(t) ||
    /\b(?:82\/50|90\/60|80\/50)\b/.test(t);
  c.tachycardic =
    /\btachycard/i.test(t) ||
    /\brapid (?:heart|pulse)\b/i.test(t) ||
    /\bhr[^\d]{0,8}(?:1[0-2]\d|13[0-5])\b/i.test(t);
  c.bradycardic = /\bbradycard/i.test(t) || /\bslow (?:heart|pulse)\b/i.test(t);
  c.febrile =
    /\bfebril/i.test(t) ||
    /\bfever/i.test(t) ||
    /\btemp[^\d]{0,8}(?:3[89]|4[0-2])/i.test(t);
  c.afebrile = /\bafebrile\b/i.test(t) || /\bno fever\b/i.test(t);
  c.hypoxic =
    /\bhypox/i.test(t) ||
    /\bspo2[^\d]{0,8}(?:[7-8]\d|9[0-2])\b/i.test(t) ||
    /\brespiratory distress\b/i.test(t) ||
    /\bsevere respiratory\b/i.test(t) ||
    /\bin extremis\b/i.test(t);
  c.septic =
    /\bsepsis\b/i.test(t) ||
    /\bseptic\b/i.test(t) ||
    /\blactate[^\d]{0,8}(?:[3-9]|1[0-9])/i.test(t);
  return c;
}

function isParoxysmalOrCrisis(text, diagnosis) {
  const blob = `${text} ${diagnosis}`;
  return (
    /\b(?:paroxysmal|pheochromocytoma|catecholamine|hypertensive crisis|hypertensive emergency)\b/i.test(
      blob,
    ) ||
    /\b(?:sbp|bp)[^\d]{0,12}(?:1[89]\d|2\d\d)\//i.test(blob)
  );
}

/** Compose audit-style clinical blob for cue extraction. */
export function composeClinicalText({
  hpi = '',
  title = '',
  diagnosis = '',
  chiefComplaint = '',
  patientVoice = null,
  exam = null,
} = {}) {
  const pv = patientVoice || {};
  return [
    hpi,
    title,
    diagnosis,
    chiefComplaint || pv.chief_complaint,
    pv.history,
    exam ? JSON.stringify(exam) : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Adjust vitals when narrative cues conflict with parsed numbers.
 * Skips when vitalsSource === 'authored' (hard-coded overrides win).
 *
 * @returns {{ vitals: object, adjusted: boolean, reasons: string[], vitalsSource: string }}
 */
export function resolveClinicalVitals({
  vitals = {},
  diagnosis = '',
  clinicalText = '',
  seed = 0,
  vitalsSource = '',
} = {}) {
  if (vitalsSource === 'authored') {
    return { vitals: clampVitals(vitals), adjusted: false, reasons: [], vitalsSource };
  }

  const cues = extractClinicalVitalCues(`${clinicalText} ${diagnosis}`);
  let out = { ...vitals };
  const reasons = [];
  let adjusted = false;

  if (cues.hypertensive && (out.sbp ?? 0) < 140) {
    if (isParoxysmalOrCrisis(clinicalText, diagnosis)) {
      out.sbp = seedRange(seed, 1, 178, 192);
      out.dbp = seedRange(seed, 2, 108, 118);
      reasons.push('hypertensive paroxysm/crisis cue → stage 2 BP');
    } else {
      out.sbp = seedRange(seed, 1, 132, 139);
      out.dbp = seedRange(seed, 2, 84, 89);
      reasons.push('hypertensive cue → stage 1 BP');
    }
    adjusted = true;
  }

  if (cues.tachycardic && (out.hr ?? 0) < 100) {
    out.hr = seedRange(seed, 3, 108, 122);
    reasons.push('tachycardic cue → HR raised');
    adjusted = true;
  }

  if (cues.bradycardic && (out.hr ?? 100) > 60) {
    out.hr = seedRange(seed, 4, 48, 58);
    reasons.push('bradycardic cue → HR lowered');
    adjusted = true;
  }

  if (cues.hypotensive && (out.sbp ?? 120) > 100) {
    out.sbp = seedRange(seed, 5, 82, 94);
    out.dbp = seedRange(seed, 6, 48, 58);
    reasons.push('hypotensive/shock cue → BP lowered');
    adjusted = true;
  }

  if (cues.febrile && (out.temp ?? 37) < 38.0) {
    out.temp = seedTemp(seed, 7, 38.5, 39.2);
    reasons.push('febrile cue → temp raised');
    adjusted = true;
  }

  const feverStory = cues.febrile || /\bfever\b/i.test(clinicalText);
  if ((cues.afebrile || !feverStory) && !cues.septic && (out.temp ?? 37) >= 38.0) {
    out.temp = seedTemp(seed, 8, 36.8, 37.2);
    reasons.push('no fever story → temp normalized');
    adjusted = true;
  }

  if (cues.hypoxic && (out.spo2 ?? 98) > 93) {
    out.spo2 = seedRange(seed, 9, 86, 92);
    reasons.push('hypoxic cue → SpO2 lowered');
    adjusted = true;
  }

  if (cues.septic) {
    let septicAdjusted = false;
    if ((out.temp ?? 37) < 38.0) {
      out.temp = seedTemp(seed, 10, 38.6, 39.4);
      septicAdjusted = true;
    }
    if ((out.hr ?? 0) < 100) {
      out.hr = seedRange(seed, 11, 104, 118);
      septicAdjusted = true;
    }
    if ((out.lactate ?? 0) < 2.5) {
      out.lactate = Math.round((2.8 + seedRange(seed, 12, 0, 5) * 0.2) * 10) / 10;
      septicAdjusted = true;
    }
    if (septicAdjusted) {
      reasons.push('septic cue → vitals aligned');
      adjusted = true;
    }
  }

  out = clampVitals(out);
  return {
    vitals: out,
    adjusted,
    reasons,
    vitalsSource: adjusted ? 'clinical-rule' : vitalsSource,
  };
}
