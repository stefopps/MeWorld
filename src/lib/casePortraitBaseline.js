import { STORAGE } from './storageKeys.js';
import { portraitCacheBust } from './patientImage.js';

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE.casePortraitBaseline);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE.casePortraitBaseline, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function readCasePortraitBaseline(caseId) {
  if (caseId == null) return null;
  return readMap()[String(caseId)] || null;
}

export function writeCasePortraitBaseline(caseId, url) {
  if (caseId == null || !url) return;
  const map = readMap();
  map[String(caseId)] = portraitCacheBust(url, `baseline-${caseId}`);
  writeMap(map);
}
