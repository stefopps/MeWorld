/**
 * Per-case pin layout — save and restore exact (cx, cy) positions of all placed
 * order labels so the user can snap pins back to their manually-arranged layout.
 *
 * Saved to localStorage keyed by case id.  Independent of play session
 * checkpoints — persists across restarts.
 */
import { STORAGE } from './storageKeys.js';

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000;
}

export function casePinLayoutStorageKey(caseId) {
  return `${STORAGE.casePinLayout}_${caseId}`;
}

/**
 * Read the saved layout for a case (null if none saved yet).
 * @returns {{ version: number, caseId: string, pins: Record<string,{cx:number,cy:number}>, savedAt: string } | null}
 */
export function readCasePinLayout(caseId) {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(casePinLayoutStorageKey(caseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.pins && typeof parsed.pins === 'object') return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Write the pin layout.  `pinMap` is { label: { cx, cy }, ... }.
 */
export function writeCasePinLayout(caseId, pinMap, { timestamp = true } = {}) {
  try {
    if (typeof window === 'undefined') return;
    const payload = {
      version: 1,
      caseId: String(caseId),
      pins: pinMap,
      savedAt: timestamp ? new Date().toISOString() : undefined,
      count: Object.keys(pinMap).length,
    };
    localStorage.setItem(casePinLayoutStorageKey(caseId), JSON.stringify(payload));
    return payload;
  } catch {
    return null;
  }
}

/** Delete a saved layout. */
export function clearCasePinLayout(caseId) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(casePinLayoutStorageKey(caseId));
  } catch {
    /* ignore */
  }
}

/**
 * Extract { label → { cx, cy } } from the current pins array.
 * Skips pins without explicit cx/cy.
 */
export function captureCasePinLayout(pins = []) {
  const map = {};
  for (const pin of pins) {
    if (!pin.label || pin.cx == null || pin.cy == null) continue;
    map[pin.label] = { cx: round4(pin.cx), cy: round4(pin.cy) };
  }
  return map;
}

/**
 * Apply saved positions to a pins array.
 * Returns a new array — pins whose label matches a saved entry get overlaid
 * coordinates.  Pins without a saved coordinate pass through unchanged.
 */
export function applyCasePinLayout(pins, caseId) {
  const layout = readCasePinLayout(caseId);
  if (!layout?.pins) return pins;
  const pinMap = layout.pins;
  let changed = false;
  const next = pins.map((pin) => {
    const saved = pinMap[pin.label];
    if (!saved) return pin;
    changed = true;
    return { ...pin, cx: saved.cx, cy: saved.cy };
  });
  return changed ? next : pins;
}

/**
 * Update a single pin's saved position (called after drag).
 * Merges with existing layout so other saved pins aren't lost.
 */
export function persistCasePinMove(caseId, pinLabel, cx, cy) {
  const layout = readCasePinLayout(caseId);
  const pinMap = layout?.pins ? { ...layout.pins } : {};
  pinMap[pinLabel] = { cx: round4(cx), cy: round4(cy) };
  writeCasePinLayout(caseId, pinMap, { timestamp: false });
}
