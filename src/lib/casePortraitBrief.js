import { STORAGE } from './storageKeys.js';

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE.casePortraitBrief);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE.casePortraitBrief, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Per-case custom Magnific portrait direction. */
export function readCasePortraitBrief(caseId) {
  if (caseId == null) return { enabled: false, text: '' };
  const row = readMap()[String(caseId)];
  if (!row || typeof row !== 'object') return { enabled: false, text: '' };
  return {
    enabled: Boolean(row.enabled),
    text: typeof row.text === 'string' ? row.text : '',
  };
}

export function writeCasePortraitBrief(caseId, { enabled, text }) {
  if (caseId == null) return;
  const map = readMap();
  const id = String(caseId);
  if (!enabled && !String(text || '').trim()) {
    delete map[id];
  } else {
    map[id] = {
      enabled: Boolean(enabled),
      text: String(text || '').trim(),
      updatedAt: new Date().toISOString(),
    };
  }
  writeMap(map);
}

/** Text sent to Magnific when custom portrait is enabled. */
export function resolvePortraitBriefForApi(caseId) {
  const brief = readCasePortraitBrief(caseId);
  if (!brief.enabled) return '';
  return brief.text.trim();
}
