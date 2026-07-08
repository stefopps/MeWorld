/**
 * Physiologic display limits for simulator vitals.
 *
 * Sources (adult ED / acute care):
 * - Cleveland Clinic — Vital Signs: https://my.clevelandclinic.org/health/articles/10881-vital-signs
 * - Medical News Today — vital sign ranges: https://www.medicalnewstoday.com/articles/vital-signs
 * - Cardiovascular Physiology Concepts / acute care SpO2 guide (normal >95%, hypoxemia <90%)
 *
 * SpO2 is a percentage — hard cap 100 (pulse ox cannot read >100%).
 */

export const VITAL_LIMITS = {
  spo2: { min: 0, max: 100, unit: '%' },
  hr: { min: 20, max: 250, unit: 'bpm' },
  rr: { min: 4, max: 60, unit: '/min' },
  sbp: { min: 40, max: 300, unit: 'mmHg' },
  dbp: { min: 20, max: 200, unit: 'mmHg' },
  temp: { min: 32, max: 42, unit: '°C' },
  lactate: { min: 0.3, max: 25, unit: 'mmol/L' },
};

function clampNum(value, min, max) {
  if (value == null || !Number.isFinite(Number(value))) return value;
  const n = Number(value);
  return Math.min(max, Math.max(min, n));
}

/** Clamp each vital to physiologic display bounds; keep dbp < sbp when both set. */
export function clampVitals(vitals = {}) {
  if (!vitals || typeof vitals !== 'object') return vitals;
  const out = { ...vitals };
  const L = VITAL_LIMITS;

  if (out.spo2 != null) out.spo2 = clampNum(out.spo2, L.spo2.min, L.spo2.max);
  if (out.hr != null) out.hr = clampNum(out.hr, L.hr.min, L.hr.max);
  if (out.rr != null) out.rr = clampNum(out.rr, L.rr.min, L.rr.max);
  if (out.sbp != null) out.sbp = clampNum(out.sbp, L.sbp.min, L.sbp.max);
  if (out.dbp != null) out.dbp = clampNum(out.dbp, L.dbp.min, L.dbp.max);
  if (out.temp != null) out.temp = clampNum(out.temp, L.temp.min, L.temp.max);
  if (out.lactate != null) out.lactate = clampNum(out.lactate, L.lactate.min, L.lactate.max);

  if (out.sbp != null && out.dbp != null && out.dbp >= out.sbp) {
    out.dbp = Math.max(L.dbp.min, out.sbp - 1);
  }

  return out;
}
