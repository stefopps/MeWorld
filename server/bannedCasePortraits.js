/**
 * Steve-banned cached case portraits — do not serve, ship, or reuse in gen refs.
 * See dev/case-portraits/BANNED.md
 */

/** Normalized slug: "153", "U01", … (no case_ prefix) */
export const BANNED_CASE_PORTRAIT_SLUGS = new Set([
  '002',
  '004',
  '005',
  '006',
  '028',
  '029',
  '030',
  '031',
  '032',
  '033',
  '043',
  '054',
  '073',
  '075',
  '083',
  '089',
  '105',
  '112',
  '113',
  '121',
  '122',
  '148',
  '167',
  'U01',
  'U02',
  'U09',
]);

export function normalizePortraitBanSlug(caseId) {
  const raw = String(caseId ?? '').trim().replace(/^case_/i, '');
  if (/^U\d+$/i.test(raw)) return raw.toUpperCase();
  if (/^\d+$/.test(raw)) return raw.padStart(3, '0');
  return raw;
}

export function isCasePortraitBanned(caseId) {
  return BANNED_CASE_PORTRAIT_SLUGS.has(normalizePortraitBanSlug(caseId));
}

/** All portrait artifact filenames for a banned case id. */
export function bannedPortraitArtifactNames(caseId) {
  const slug = normalizePortraitBanSlug(caseId);
  const prefix = /^U/i.test(slug) ? `case_${slug}` : `case_${slug}`;
  return [
    `${prefix}.png`,
    `${prefix}_iv.png`,
    `${prefix}_mask.png`,
    `${prefix}-baseline.png`,
    `${prefix}.json`,
  ];
}
