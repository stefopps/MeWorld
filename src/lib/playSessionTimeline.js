import { STORAGE } from './storageKeys.js';

function sessionKey(caseId, sessionId) {
  return `${String(caseId)}:${String(sessionId)}`;
}

function readAllTimelines() {
  try {
    const raw = localStorage.getItem(STORAGE.playSessionTimeline);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAllTimelines(map) {
  try {
    localStorage.setItem(STORAGE.playSessionTimeline, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function readSessionOrderTimeline(caseId, sessionId) {
  if (caseId == null || caseId === '' || !sessionId) return [];
  const rows = readAllTimelines()[sessionKey(caseId, sessionId)];
  return Array.isArray(rows) ? rows : [];
}

export function writeSessionOrderTimeline(caseId, sessionId, events) {
  if (caseId == null || caseId === '' || !sessionId) return;
  const all = readAllTimelines();
  all[sessionKey(caseId, sessionId)] = Array.isArray(events) ? events : [];
  writeAllTimelines(all);
}

export function appendSessionOrderTimeline(caseId, sessionId, entry) {
  if (caseId == null || caseId === '' || !sessionId || !entry) return;
  const all = readAllTimelines();
  const key = sessionKey(caseId, sessionId);
  const prev = Array.isArray(all[key]) ? all[key] : [];
  if (prev.some((row) => row.id === entry.id)) return;
  all[key] = [...prev, entry];
  writeAllTimelines(all);
}

export function clearSessionOrderTimeline(caseId, sessionId) {
  if (caseId == null || caseId === '' || !sessionId) return;
  const all = readAllTimelines();
  delete all[sessionKey(caseId, sessionId)];
  writeAllTimelines(all);
}
