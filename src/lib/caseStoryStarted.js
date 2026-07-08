import { STORAGE } from './storageKeys.js';

function caseKey(caseId) {
  return String(caseId ?? '').trim().padStart(3, '0').replace(/^case_/i, '');
}

function readStore() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE.caseStoryStarted);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(doc) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE.caseStoryStarted, JSON.stringify(doc));
  } catch {
    /* ignore */
  }
}

export function readCaseStoryStarted(caseId) {
  const id = caseKey(caseId);
  if (!id) return false;
  return Boolean(readStore()[id]);
}

export function markCaseStoryStarted(caseId) {
  const id = caseKey(caseId);
  if (!id) return;
  const store = readStore();
  if (store[id]) return;
  store[id] = new Date().toISOString();
  writeStore(store);
}

export function readOrderStoryPinned(caseId, orderLabel = '') {
  const label = String(orderLabel || '').trim();
  if (!label) return false;
  try {
    const raw = localStorage.getItem(STORAGE.teachingMoments);
    const store = raw ? JSON.parse(raw) : {};
    const list = Array.isArray(store[caseKey(caseId)]) ? store[caseKey(caseId)] : [];
    return list.some((m) => String(m.orderLabel || '').trim() === label);
  } catch {
    return false;
  }
}
