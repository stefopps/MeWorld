import { STORAGE } from './storageKeys.js';
import { notifyTextPrefsChanged } from './textPrefsSync.js';

/** Steve default — legible clinical copy (~138%). */
const DEFAULT = { fontScale: 1.38, weight: 600 };

export function readClinicalTextPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE.clinicalTextPrefs);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    const fontScale = Number(parsed?.fontScale);
    const weight = Number(parsed?.weight);
    return {
      fontScale: Number.isFinite(fontScale) ? Math.min(2, Math.max(0.9, fontScale)) : DEFAULT.fontScale,
      weight: [500, 600, 700].includes(weight) ? weight : DEFAULT.weight,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function writeClinicalTextPrefs(prefs) {
  try {
    localStorage.setItem(STORAGE.clinicalTextPrefs, JSON.stringify(prefs));
    notifyTextPrefsChanged({ kind: 'clinical', prefs });
  } catch {
    /* ignore */
  }
}

export function clinicalTextStyle(prefs = readClinicalTextPrefs()) {
  const basePx = 16;
  return {
    '--clinical-font-size': `${Math.round(basePx * prefs.fontScale)}px`,
    '--clinical-font-weight': String(prefs.weight),
  };
}
