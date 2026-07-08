import { STORAGE } from './storageKeys.js';
import { notifyTextPrefsChanged } from './textPrefsSync.js';

/** Steve default — legible Teach Me / rationale copy (~124%). */
const DEFAULT = { fontScale: 1.24, weight: 500 };

export function readTeachMeTextPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE.teachMeTextPrefs);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    const fontScale = Number(parsed?.fontScale);
    const weight = Number(parsed?.weight);
    return {
      fontScale: Number.isFinite(fontScale) ? Math.min(1.5, Math.max(0.9, fontScale)) : DEFAULT.fontScale,
      weight: [500, 600, 700].includes(weight) ? weight : DEFAULT.weight,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function writeTeachMeTextPrefs(prefs) {
  try {
    localStorage.setItem(STORAGE.teachMeTextPrefs, JSON.stringify(prefs));
    notifyTextPrefsChanged({ kind: 'teachMe', prefs });
  } catch {
    /* ignore */
  }
}

export function teachMeTextStyle(prefs = readTeachMeTextPrefs()) {
  const basePx = 12;
  return {
    '--teach-me-font-size': `${Math.round(basePx * prefs.fontScale)}px`,
    '--teach-me-font-weight': String(prefs.weight),
  };
}
