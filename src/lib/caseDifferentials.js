import differentialsData from '../data/caseDifferentials.json' with { type: 'json' };
import differentialBank from '../data/differentialBank.json' with { type: 'json' };

/**
 * Pilot — only these cases get the differential tab in play/briefing.
 * Remove or expand this set when the pattern is validated.
 */
export const DIFFERENTIAL_PILOT_CASE_IDS = new Set(['U12']);

function normalizeCaseId(id) {
  const raw = String(id ?? '').replace(/^case[_-]?/i, '').trim();
  if (!raw) return '';
  if (/^U\d+$/i.test(raw)) return raw.toUpperCase();
  return raw.padStart(3, '0');
}

function slugify(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function lookupCuratedBlock(caseData) {
  const candidates = [String(caseData?.id ?? '').trim(), normalizeCaseId(caseData?.id)];
  const seen = new Set();
  for (const key of candidates) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const block = differentialsData.cases?.[key];
    if (block?.items?.length) return block;
  }
  return null;
}

/** Map play/briefing case → differentialBank row (same source as mobile practice). */
export function resolveDifferentialBankEntry(caseData = {}) {
  const members = caseData?.uberMeta?.memberCaseIds || [];
  for (const raw of members) {
    const num = Number.parseInt(String(raw).replace(/^0+/, ''), 10);
    if (!Number.isFinite(num)) continue;
    const hit = differentialBank.find((e) => e.caseId === num);
    if (hit) return hit;
  }

  const rawId = String(caseData?.id ?? '').trim();
  const num = Number.parseInt(rawId.replace(/^U/i, '').replace(/^0+/, ''), 10);
  if (Number.isFinite(num)) {
    const hit = differentialBank.find((e) => e.caseId === num);
    if (hit) return hit;
  }

  const diagnosis = String(caseData?.diagnosis || '').trim().toLowerCase();
  if (diagnosis) {
    const hit = differentialBank.find(
      (e) => String(e.diagnosis || '').trim().toLowerCase() === diagnosis,
    );
    if (hit) return hit;
  }

  return null;
}

function curatedItemForLabel(curatedItems, label) {
  const key = String(label || '').trim().toLowerCase();
  return (
    curatedItems?.find((item) => item.label?.toLowerCase().trim() === key) ||
    curatedItems?.find((item) => {
      const il = item.label?.toLowerCase().trim() || '';
      return il.includes(key) || key.includes(il);
    }) ||
    null
  );
}

function buildItemsFromBank(bankEntry, curatedBlock) {
  const curatedItems = curatedBlock?.items || [];
  const primary = String(bankEntry?.diagnosis || '').trim();
  const seen = new Set();
  const items = [];

  for (const raw of bankEntry?.diagnoses || []) {
    const label = String(raw || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const curated = curatedItemForLabel(curatedItems, label);
    items.push({
      id: curated?.id || slugify(label) || `dx-${items.length}`,
      label,
      why: curated?.why || '',
      discriminator: curated?.discriminator || '',
      isCaseDiagnosis:
        primary &&
        (key === primary.toLowerCase() ||
          primary.toLowerCase().includes(key) ||
          key.includes(primary.toLowerCase())),
    });
  }

  return items;
}

export function isDifferentialPilotCase(caseData = {}) {
  const raw = String(caseData?.id ?? '').trim().toUpperCase();
  const norm = normalizeCaseId(caseData?.id);
  return DIFFERENTIAL_PILOT_CASE_IDS.has(raw) || DIFFERENTIAL_PILOT_CASE_IDS.has(norm);
}

export function getCaseDifferentials(caseData = {}) {
  if (!isDifferentialPilotCase(caseData)) return null;

  const bankEntry = resolveDifferentialBankEntry(caseData);
  const curated = lookupCuratedBlock(caseData);

  if (bankEntry?.diagnoses?.length) {
    const items = buildItemsFromBank(bankEntry, curated);
    if (!items.length) return null;
    return {
      title: curated?.title || `Differential — ${bankEntry.topic || caseData.title || 'case'}`,
      subtitle:
        curated?.subtitle ||
        (bankEntry.diagnosis ? `Working diagnosis: ${bankEntry.diagnosis}` : ''),
      diagnosis: bankEntry.diagnosis || caseData?.diagnosis || '',
      items,
      source: curated ? 'curated+bank' : 'bank',
    };
  }

  if (curated?.items?.length) {
    return {
      title: curated.title || 'Differentials',
      subtitle: curated.subtitle || '',
      diagnosis: caseData?.diagnosis || '',
      items: curated.items.map((item) => ({ ...item, isCaseDiagnosis: false })),
      source: 'curated',
    };
  }

  return null;
}

export function caseHasDifferentials(caseData = {}) {
  return Boolean(getCaseDifferentials(caseData)?.items?.length);
}
