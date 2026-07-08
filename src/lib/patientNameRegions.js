import banks from '../data/patientNameBanks.json' with { type: 'json' };
import { STORAGE } from './storageKeys.js';

const REGIONS = banks?.regions || {};

export const DEFAULT_NAME_REGION = banks?.defaultRegion || 'mixed';

/** Underlying regions rotated when "Mixed (NYC)" is selected — one culture per case #. */
export const MIXED_SOURCE_REGIONS = ['ghana', 'chinese', 'brazilian', 'indian', 'nigerian'];

export const NAME_REGION_CHOICES = Object.entries(REGIONS).map(([id, region]) => ({
  id,
  label: region?.label || id,
}));

export function normalizeNameRegion(value) {
  const str = String(value || '').toLowerCase().trim();
  if (REGIONS[str]) return str;
  for (const [id, region] of Object.entries(REGIONS)) {
    if (String(region?.label || '').toLowerCase() === str) return id;
  }
  return DEFAULT_NAME_REGION;
}

function readProfileNameRegion() {
  try {
    const raw = localStorage.getItem(STORAGE.audienceProfile);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.nameRegion === 'string' ? parsed.nameRegion : null;
  } catch {
    return null;
  }
}

/** Active region from Settings → audience profile. */
export function getActiveNameRegion() {
  return normalizeNameRegion(readProfileNameRegion());
}

export function getNameRegionLabel(regionId) {
  const id = normalizeNameRegion(regionId);
  return REGIONS[id]?.label || id;
}

export function getNamesForRegion(regionId) {
  const id = normalizeNameRegion(regionId);
  return REGIONS[id]?.names || [];
}
