import { STORAGE } from './storageKeys.js';

export const STACKER_REVIEW_SECONDS = 20;
/** DeepSeek incremental parse interval during stacker practice */
export const STACKER_INCREMENTAL_SECONDS = 20;
/** First DeepSeek clean pass after recording starts */
export const STACKER_FIRST_PARSE_SECONDS = 10;
/** Start final DeepSeek pass when this many seconds remain on the practice timer */
export const STACKER_PREFINAL_LEAD_SECONDS = 10;

const DEFAULTS = {
  enabled: false,
  seconds: 60,
};

export function readStackerPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE.differentialStackerPrefs);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      seconds: [30, 45, 60, 90, 120].includes(parsed.seconds) ? parsed.seconds : 60,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeStackerPrefs(prefs) {
  try {
    localStorage.setItem(STORAGE.differentialStackerPrefs, JSON.stringify({
      enabled: Boolean(prefs.enabled),
      seconds: prefs.seconds || 60,
    }));
  } catch {
    /* ignore */
  }
}
