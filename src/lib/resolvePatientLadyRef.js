import ladyRefs from '../data/patientLadyRefs.json' with { type: 'json' };
import { normalizeNameRegion, MIXED_SOURCE_REGIONS } from './patientNameRegions.js';
import { resolvePortraitSex } from './portraitSex.js';

/** LongMan Atta lady character map for female case portraits (identity only — scene stays 16:9 landscape). */
export function resolvePatientLadyRef(caseContext = {}, { sex: sexOverride } = {}) {
  const sex =
    sexOverride ||
    caseContext?.patientSex ||
    caseContext?.patientFacts?.sex ||
    resolvePortraitSex(caseContext);
  if (sex !== 'female') return null;

  const region = normalizeNameRegion(caseContext?.nameRegion || 'mixed');
  const caseNum = Number(caseContext?.ccsNumber ?? caseContext?.id) || 1;
  const caseKey = String(caseContext?.id ?? caseContext?.ccsNumber ?? '')
    .replace(/^case_/i, '')
    .padStart(3, '0');

  let slug =
    caseContext?.ladyRefSlug ||
    ladyRefs.caseSlugs?.[caseKey] ||
    ladyRefs.caseSlugs?.[String(caseNum)];
  if (!slug) slug = ladyRefs.regionSlugs?.[region];
  if (!slug && region === 'mixed') {
    const mixedRegion = MIXED_SOURCE_REGIONS[(caseNum - 1) % MIXED_SOURCE_REGIONS.length];
    slug = ladyRefs.regionSlugs?.[mixedRegion];
    if (!slug) {
      const pool = ladyRefs.mixedRotation || [];
      slug = pool.length ? pool[(caseNum - 1) % pool.length] : ladyRefs.defaultSlug;
    }
  }
  slug = slug || ladyRefs.defaultSlug;

  const entry = ladyRefs.refs?.[slug];
  if (!entry?.file) return null;

  const assetBase = ladyRefs.assetBase || '/assets/patient/ladies';
  return {
    slug,
    label: entry.label || slug,
    file: entry.file,
    publicUrl: `${assetBase}/${entry.file}`,
    sourcePath: entry.sourcePath || null,
    identityPrompt: entry.identityPrompt || '',
  };
}
