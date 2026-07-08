import {
  patchActiveAttendingStyleDepth,
  readActiveAttendingDepth,
} from './attendingStylePrefs.js';

/** First attending opinion length — interconnected teaching arc. */
export const FIRST_OPINION_DEPTH_LEVELS = [
  { id: 0, label: 'Brief', maxWords: 100, maxTokens: 280 },
  { id: 1, label: 'Standard', maxWords: 140, maxTokens: 380 },
  { id: 2, label: 'Deep', maxWords: 180, maxTokens: 480 },
  { id: 3, label: 'Full arc', maxWords: 220, maxTokens: 520 },
];

const DEFAULT_DEPTH = 3;

/** Active attending slot depth (A/B each store their own). */
export function readFirstOpinionDepth() {
  return readActiveAttendingDepth();
}

export function writeFirstOpinionDepth(depth) {
  const n = Math.max(0, Math.min(3, Number(depth) || 0));
  patchActiveAttendingStyleDepth(n);
  return n;
}

export function resolveFirstOpinionDepthConfig(depth = readFirstOpinionDepth()) {
  const id = Math.max(0, Math.min(3, Number(depth) || 0));
  return FIRST_OPINION_DEPTH_LEVELS[id] || FIRST_OPINION_DEPTH_LEVELS[DEFAULT_DEPTH];
}
