import { STORAGE } from './storageKeys.js';

const DEFAULT_MARGIN = { top: 0.01, bottom: 0.07, left: 0.19, right: 0.17 };
/** Bump this number when defaults change — forces old localStorage values to be replaced. */
const MARGIN_VERSION = 2;
const MAX_MARGIN = 0.5;

/** Read the user's drop margin from localStorage */
export function readSceneDropMargin() {
  try {
    const raw = localStorage.getItem(STORAGE.sceneDropMargin);
    if (!raw) return { ...DEFAULT_MARGIN };
    const parsed = JSON.parse(raw);
    // Version mismatch → saved values are stale; write new defaults and return them
    if (parsed.version !== MARGIN_VERSION) {
      writeSceneDropMargin(DEFAULT_MARGIN);
      return { ...DEFAULT_MARGIN };
    }
    return {
      top: clamp(parsed.top ?? 0),
      bottom: clamp(parsed.bottom ?? 0),
      left: clamp(parsed.left ?? 0),
      right: clamp(parsed.right ?? 0),
    };
  } catch {
    return { ...DEFAULT_MARGIN };
  }
}

/** Write the drop margin to localStorage */
export function writeSceneDropMargin(margin) {
  localStorage.setItem(STORAGE.sceneDropMargin, JSON.stringify({
    version: MARGIN_VERSION,
    top: clamp(margin.top),
    bottom: clamp(margin.bottom),
    left: clamp(margin.left),
    right: clamp(margin.right),
  }));
}

/** Compute imageFrame from margin values (all 0-0.5) */
export function frameFromMargin(margin) {
  const m = margin || DEFAULT_MARGIN;
  return {
    x: clamp(m.left),
    y: clamp(m.top),
    w: Math.max(0.05, 1 - clamp(m.left) - clamp(m.right)),
    h: Math.max(0.05, 1 - clamp(m.top) - clamp(m.bottom)),
  };
}

function clamp(v) {
  return Math.max(0, Math.min(MAX_MARGIN, Number(v) || 0));
}
