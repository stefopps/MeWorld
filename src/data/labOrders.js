import medicalOrders from './medical-orders.json';
import { normCommandText } from '../lib/orderCommandAutocomplete.js';

/** CCS lab picker = core labs + bedside cardiac/monitor orders clinicians expect here. */
const LAB_PICKER_CARDIAC = Object.freeze([
  'ECG',
  ...(medicalOrders.imaging || []).filter((name) => /^ecg\b/i.test(name)),
  ...(medicalOrders.monitoring || []).filter((name) =>
    /cardiac monitor|telemetry/i.test(name),
  ),
]);

function uniqueOrderNames(...groups) {
  const seen = new Set();
  const out = [];
  for (const group of groups) {
    for (const name of group) {
      const key = String(name || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(String(name).trim());
    }
  }
  return out;
}

export const LAB_ORDER_NAMES = Object.freeze(
  uniqueOrderNames(LAB_PICKER_CARDIAC, medicalOrders.labs || []),
);

const LAB_SEARCH_ALIASES = {
  ecg: ['ecg', 'ekg', 'electrocardiog'],
  ekg: ['ecg', 'ekg', 'electrocardiog'],
  ekg12: ['ecg', '12lead', '12 lead'],
};

const LAB_LABEL_RE =
  /\b(cbc|bmp|cmp|lft|lab|troponin|abg|vbg|culture|urinalysis|glucose|tsh|pt\b|ptt|inr|lipid|hba1c|lactate|d-dimer|bnp|crp|esr|coag|metabolic|electrocardi|ecg|ekg|pulse ox|vital sign|blood count|hemoglobin|ferritin|magnesium|phosphorus|bilirubin|amylase|lipase|hcg|pregnancy test|reticulocyte|coombs|haptoglobin|ana\b|dsdna|complement|procalcitonin|drug level|drug screen)\b/i;

export function isLabPickerTrigger(text) {
  const t = normCommandText(text);
  return t === 'lab' || t === 'labs' || t === 'order lab' || t === 'order labs';
}

/** Stack labels that look like labs/imaging workup — for picker suggestions. */
export function suggestedLabNamesFromInterventions(interventions = []) {
  const out = [];
  const seen = new Set();
  for (const iv of interventions) {
    const label = String(iv?.label || '').trim();
    if (!label || !LAB_LABEL_RE.test(label)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

export function filterLabOrderNames(query = '', names = LAB_ORDER_NAMES) {
  const q = normCommandText(query);
  if (!q) return names;
  const needles = LAB_SEARCH_ALIASES[q] || [q];
  return names.filter((name) => {
    const n = normCommandText(name);
    const compact = n.replace(/\s/g, '');
    return needles.some((needle) => {
      const h = needle.replace(/\s/g, '');
      return n.includes(needle) || compact.includes(h);
    });
  });
}
