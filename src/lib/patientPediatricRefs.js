import refsBundle from '../data/patientPediatricRefs.json' with { type: 'json' };
import { getUberDefinition } from './uberCases.js';

function normalizePediatricCaseId(caseId) {
  const raw = String(caseId ?? '').trim();
  if (!raw) return '';
  if (/^U\d+$/i.test(raw)) return raw.toUpperCase();
  const digits = raw.replace(/^case_/i, '').replace(/^0+/, '') || raw.replace(/^case_/i, '');
  return /^\d+$/.test(digits) ? digits.padStart(3, '0') : raw;
}

function matchCategoryPattern(category = '') {
  const cat = String(category || '');
  for (const row of refsBundle.categoryPatterns || []) {
    if (!row?.match) continue;
    const re = new RegExp(row.match, 'i');
    if (re.test(cat)) {
      return {
        ageYears: row.ageYears ?? refsBundle.defaultAgeYears ?? 7,
        label: row.label || 'pediatric patient',
        prompt: row.prompt || '',
        memorableAccessory: String(row.memorableAccessory || '').trim() || null,
        source: 'category',
      };
    }
  }
  return null;
}

/** Shipped photoreal temperament character map by slug (identity ref — not runtime Play scene). */
export function resolvePediatricCharacterMap(slug) {
  const key = String(slug ?? '').trim();
  if (!key) return null;
  const row = (refsBundle.temperamentCharacterMaps || []).find((r) => r.slug === key);
  if (!row || row.status !== 'approved') return null;
  const assetBase = refsBundle.assetBase || '/assets/patient/pediatric';
  const mapFile = row.mapFile || `${key}-CHARACTER-MAP.png`;
  const mapFileAlt2 = row.mapFileAlt2 || `${key}-CHARACTER-MAP-alt2.png`;
  return {
    slug: key,
    file: mapFile,
    mapFileAlt2,
    publicUrl: `${assetBase}/${mapFile}`,
    publicUrlAlt2: `${assetBase}/${mapFileAlt2}`,
    refImage: row.refImage || null,
    use: row.use || null,
    canonicalAlt: row.canonicalAlt ?? 1,
    status: row.status,
  };
}

/** Per-case pediatric portrait lock from patientPediatricRefs.json */
export function resolvePediatricPortraitRef(caseId, caseData = {}) {
  const id = normalizePediatricCaseId(caseId ?? caseData?.id ?? caseData?.ccsNumber);
  const byId = id && refsBundle.caseIds?.[id];
  if (byId) {
    return {
      caseId: id,
      ageYears: byId.ageYears ?? refsBundle.defaultAgeYears ?? 7,
      label: byId.label || 'pediatric patient',
      prompt: String(byId.prompt || '').trim(),
      memorableAccessory: String(byId.memorableAccessory || '').trim() || null,
      ethnicityCue: String(byId.ethnicityCue || '').trim() || null,
      portraitRefSlug: byId.portraitRefSlug || byId.temperamentSlug || null,
      temperamentSlug: byId.temperamentSlug || byId.portraitRefSlug || null,
      isPediatric: true,
      source: 'caseId',
    };
  }
  if (id && /^U\d+$/i.test(id)) {
    const uber = getUberDefinition(id);
    if (uber?.anchorId) {
      return resolvePediatricPortraitRef(uber.anchorId, caseData);
    }
  }
  const fromCategory = matchCategoryPattern(caseData?.category);
  if (fromCategory) {
    return { caseId: id || null, ...fromCategory, isPediatric: true };
  }
  return null;
}

export function resolvePediatricMemorableAccessory(caseId, caseData = {}) {
  const ref = resolvePediatricPortraitRef(caseId, caseData);
  if (ref?.memorableAccessory) return ref.memorableAccessory;
  if (refsBundle.accessoryRule && ref?.isPediatric) {
    return refsBundle.categoryPatterns?.[0]?.memorableAccessory || null;
  }
  return null;
}

export function pediatricAgeLabel(ref) {
  if (!ref) return null;
  const yrs = Number(ref.ageYears);
  if (!Number.isFinite(yrs)) return null;
  if (yrs === 0) return ref.label || 'term newborn';
  if (yrs < 1) return `${Math.max(1, Math.round(yrs * 12))} months`;
  return `${Math.round(yrs)} years`;
}

/** Merge explicit pediatric ref into demographics for portrait + patient_sim. */
export function applyPediatricPortraitRef(demographics = {}, caseId, caseData = {}) {
  const ref = resolvePediatricPortraitRef(caseId, caseData);
  if (!ref) return demographics;
  const ageLabel = pediatricAgeLabel(ref);
  const age =
    ref.ageYears === 0
      ? 0
      : ref.ageYears != null && ref.ageYears < 1
        ? Math.max(1, Math.round(Number(ref.ageYears) * 12))
        : Math.round(Number(ref.ageYears ?? 7));
  const ageUnit = ref.ageYears != null && ref.ageYears < 1 && ref.ageYears > 0 ? 'months' : 'years';
  return {
    ...demographics,
    isPediatric: true,
    speakAsChild: true,
    age,
    ageUnit,
    ageLabel: ageLabel || demographics.ageLabel,
    ageSource: 'pediatric_ref',
    pediatricPortraitRef: ref,
  };
}

export function pediatricPortraitPromptBlock(ref) {
  if (!ref?.prompt) return '';
  const ageLine = pediatricAgeLabel(ref);
  return `
PEDIATRIC BODY-SCALE LOCK (mandatory — not an adult manikin):
${ref.prompt}
${ageLine ? `Apparent age: ${ageLine}.` : ''}
Child proportions — smaller head-to-body ratio than adult, shorter limbs, pediatric hospital gown on pediatric ED stretcher.
Use pediatric baseplate scene (pedMale/pedFemale) — same ~38° bedside camera as adult plates, never 90° bird's-eye overhead.`;
}

/** Memorable accessory / comfort object — makes pediatric cases stick (Steve rule 2026-06). */
export function pediatricPortraitAccessoryBlock(ref) {
  if (!ref?.memorableAccessory && !refsBundle.accessoryRule) return '';
  const accessory = ref?.memorableAccessory;
  const rule = refsBundle.accessoryRule || '';
  const ethnicity = ref?.ethnicityCue
    ? `\nEthnicity / face character (dignified, not caricature): ${ref.ethnicityCue}`
    : '';
  return `
PEDIATRIC MEMORABLE ACCESSORY (mandatory for child cases):
${accessory || 'One comfort object on bedside table or pillow — stuffed toy, blanket, or personal item.'}
${rule ? `Rule: ${rule}` : ''}${ethnicity}
Place accessory on bedside table or pillow — never in front of monitor or IV zones.`;
}
