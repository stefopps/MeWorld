/** Nudge vitals toward stability after appropriate orders are placed. */
export function nudgeVitalsAfterOrder(vitals = {}, orderId = '', orderLabel = '') {
  const v = { ...vitals };
  const key = `${String(orderId || '').toLowerCase()} ${String(orderLabel || '').toLowerCase()}`;

  if (/phototherapy|breastfeeding|lactation|bilirubin/.test(key)) {
    if (v.temp != null) v.temp = Math.max(37.0, Number(v.temp) - 0.35);
    if (v.hr != null) v.hr = Math.max(95, Math.round(Number(v.hr) - 6));
    if (v.rr != null) v.rr = Math.max(16, Math.round(Number(v.rr) - 2));
    if (v.lactate != null) v.lactate = Math.max(1.0, Number(v.lactate) - 0.3);
  }

  if (/oxygen|o2|abg|ventilation|intubat/.test(key)) {
    if (v.spo2 != null) v.spo2 = Math.min(100, Math.round(Number(v.spo2) + 2));
    if (v.rr != null) v.rr = Math.max(12, Math.round(Number(v.rr) - 2));
  }

  if (/fluid|saline|lactated|ringer|bolus|resuscit/.test(key)) {
    if (v.sbp != null) v.sbp = Math.min(130, Math.round(Number(v.sbp) + 4));
    if (v.hr != null) v.hr = Math.max(70, Math.round(Number(v.hr) - 4));
    if (v.lactate != null) v.lactate = Math.max(0.8, Number(v.lactate) - 0.4);
  }

  if (/cbc|coombs|g6pd|tsh|lab|blood/.test(key)) {
    /* workup placed — mild reassurance nudge only when already unstable */
    if (v.hr != null && v.hr > 115) v.hr = Math.max(100, Math.round(Number(v.hr) - 3));
  }

  return v;
}
