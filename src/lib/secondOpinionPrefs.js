import { STORAGE } from './storageKeys.js';

/** Second opinion stays on Punch — brief peer mechanism (no user slider). */
export const LOCKED_SECOND_OPINION_DEPTH = 0;

/** Second opinion length — brief punch only; locked at Punch in UI. */
export const SECOND_OPINION_DEPTH_LEVELS = [
  { id: 0, label: 'Punch', maxWords: 45, maxTokens: 120 },
  { id: 1, label: 'Brief', maxWords: 65, maxTokens: 160 },
  { id: 2, label: 'Standard', maxWords: 80, maxTokens: 200 },
  { id: 3, label: 'Full brief', maxWords: 95, maxTokens: 240 },
];

const DEFAULT_DEPTH = 0;

export function readSecondOpinionDepth() {
  if (typeof localStorage === 'undefined') return DEFAULT_DEPTH;
  try {
    const raw = localStorage.getItem(STORAGE.secondOpinionDepth);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 3) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_DEPTH;
}

export function writeSecondOpinionDepth(depth) {
  const n = Math.max(0, Math.min(3, Number(depth) || 0));
  try {
    localStorage.setItem(STORAGE.secondOpinionDepth, String(n));
  } catch {
    /* ignore */
  }
  return n;
}

export function resolveSecondOpinionDepthConfig(depth = readSecondOpinionDepth()) {
  const id = Math.max(0, Math.min(3, Number(depth) || 0));
  return SECOND_OPINION_DEPTH_LEVELS[id] || SECOND_OPINION_DEPTH_LEVELS[DEFAULT_DEPTH];
}
