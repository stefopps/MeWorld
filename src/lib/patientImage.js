import { getPatientScene, getPatientSceneForCase } from '../data/gameData.js';
import { resolvePatientSceneKey } from './patientSceneKey.js';
import { sanitizeScenePlateSrc } from './scenePlatePath.js';

import { STORAGE } from './storageKeys.js';

export const VISION_ZONES_KEY = STORAGE.visionZones;

export function getBuiltInPatientSrc(caseData = null) {
  const sceneKey = caseData ? resolvePatientSceneKey(caseData) : 'male';
  const scene = caseData ? getPatientSceneForCase(caseData) : getPatientScene();
  const src = scene?.src || '/assets/patient/patient-scene.png';
  return sanitizeScenePlateSrc(src, { sceneKey });
}

/** Reject empty/truncated data URLs and other bad scene sources from localStorage. */
export function isValidSceneSrc(src) {
  if (!src || typeof src !== 'string') return false;
  const s = src.trim();
  if (!s) return false;
  if (s.startsWith('data:')) return s.length > 200;
  return s.startsWith('/') || /^https?:/i.test(s);
}

/** Drop corrupt overrides that cause an all-black ER/briefing scene. */
export function scrubInvalidSceneStorage() {
  if (typeof window === 'undefined') return;
  try {
    const patientImg = localStorage.getItem(STORAGE.patientImage);
    if (patientImg && !isValidSceneSrc(patientImg)) {
      localStorage.removeItem(STORAGE.patientImage);
      localStorage.removeItem(STORAGE.patientMime);
    }

    const regenRaw = localStorage.getItem(STORAGE.caseRegenImages);
    if (regenRaw) {
      const parsed = JSON.parse(regenRaw);
      let changed = false;
      for (const [caseId, src] of Object.entries(parsed)) {
        if (!isValidSceneSrc(src)) {
          delete parsed[caseId];
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(STORAGE.caseRegenImages, JSON.stringify(parsed));
      }
    }

    const variantsRaw = localStorage.getItem(STORAGE.sceneVariants);
    if (variantsRaw) {
      const parsed = JSON.parse(variantsRaw);
      let changed = false;
      for (const [sig, bucket] of Object.entries(parsed)) {
        if (!bucket || typeof bucket !== 'object') {
          delete parsed[sig];
          changed = true;
          continue;
        }
        // ER must always come from built-in/resolveSceneSrc — cached ER URLs caused black play scenes.
        if (bucket.ER) {
          delete bucket.ER;
          changed = true;
        }
        for (const [unit, src] of Object.entries(bucket)) {
          if (!isValidSceneSrc(src)) {
            delete bucket[unit];
            changed = true;
          }
        }
        if (Object.keys(bucket).length === 0) {
          delete parsed[sig];
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(STORAGE.sceneVariants, JSON.stringify(parsed));
      }
    }
  } catch {
    /* ignore */
  }
}

/** First usable scene image URL, else built-in hospital photo. */
export function resolveSceneSrc({ forceSrc, overrideSrc, sceneSrc, caseData } = {}) {
  const fallback = getBuiltInPatientSrc(caseData);
  const caseTemplate = isValidSceneSrc(sceneSrc) ? sceneSrc : fallback;

  // Per-case briefing/play: case portrait → sex-aware template — not global Settings upload.
  if (caseData?.id != null && caseData.id !== '') {
    const sceneKey = resolvePatientSceneKey(caseData);
    for (const candidate of [forceSrc, caseTemplate, fallback]) {
      if (isValidSceneSrc(candidate)) {
        return sanitizeScenePlateSrc(candidate, { sceneKey });
      }
    }
    return fallback;
  }

  for (const candidate of [forceSrc, overrideSrc, sceneSrc, fallback]) {
    if (isValidSceneSrc(candidate)) {
      const sceneKey = caseData ? resolvePatientSceneKey(caseData) : 'male';
      return sanitizeScenePlateSrc(candidate, { sceneKey });
    }
  }
  return fallback;
}

export function portraitCacheBust(url, version) {
  if (!url || !version) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(String(version))}`;
}

/** Built-in hospital photo or user upload (data URL). */
export async function getPatientImagePayload(caseData = null) {
  try {
    const dataUrl = localStorage.getItem(STORAGE.patientImage);
    if (dataUrl?.startsWith('data:')) {
      return {
        base64: dataUrl.split(',')[1] || '',
        mimeType: localStorage.getItem(STORAGE.patientMime) || 'image/png',
        source: 'upload',
      };
    }
  } catch {
    /* ignore */
  }

  const src = getBuiltInPatientSrc(caseData);
  const resp = await fetch(src);
  if (!resp.ok) throw new Error(`Patient image not found: ${src}`);
  const blob = await resp.blob();
  const mimeType = blob.type || 'image/png';
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return {
    base64: dataUrl.split(',')[1] || '',
    mimeType,
    source: 'builtin',
  };
}

export function readVisionZones(source) {
  try {
    const raw = localStorage.getItem(VISION_ZONES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.zones && parsed?.source) {
      if (source && parsed.source !== source) return null;
      return parsed.zones;
    }
    // Legacy: plain zone map
    if (parsed && typeof parsed === 'object' && parsed['zone-monitor']) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeVisionZones(source, zones) {
  localStorage.setItem(VISION_ZONES_KEY, JSON.stringify({ source, zones }));
}

export function clearVisionZones() {
  localStorage.removeItem(VISION_ZONES_KEY);
}
