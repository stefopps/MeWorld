import { STORAGE } from './storageKeys.js';
import { appendCaseNotesBlock } from './caseNotes.js';

function caseKey(caseId) {
  return String(caseId ?? '').padStart(3, '0').replace(/^case_/i, '');
}

function readStore() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE.teachingMoments);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(doc) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE.teachingMoments, JSON.stringify(doc));
  } catch {
    /* ignore */
  }
}

/** Learner-starred attendant beats — fed into case story compile. */
export function readTeachingMoments(caseId) {
  const id = caseKey(caseId);
  const store = readStore();
  return Array.isArray(store[id]) ? store[id] : [];
}

export function addTeachingMoment(caseId, { prompt = '', answer = '', orderLabel = '', channel = '' } = {}) {
  const id = caseKey(caseId);
  const text = String(answer || '').trim();
  if (!id || !text) return null;

  const entry = {
    id: `tm-${Date.now()}`,
    at: new Date().toISOString(),
    prompt: String(prompt || orderLabel || '').trim(),
    answer: text,
    orderLabel: String(orderLabel || '').trim(),
    channel: String(channel || '').trim(),
  };

  const store = readStore();
  const list = Array.isArray(store[id]) ? store[id] : [];
  const dup = list.some((m) => m.answer === entry.answer && m.prompt === entry.prompt);
  if (!dup) {
    store[id] = [...list, entry].slice(-24);
    writeStore(store);
  }

  const noteBody = [
    entry.orderLabel ? `**Order / question:** ${entry.orderLabel}` : '',
    entry.prompt && entry.prompt !== entry.orderLabel ? `**You asked:** ${entry.prompt}` : '',
    entry.answer,
  ]
    .filter(Boolean)
    .join('\n\n');

  appendCaseNotesBlock(caseId, noteBody, { header: '⭐ Teaching moment (case story)' });

  return entry;
}

export function formatTeachingMomentsForStory(moments = []) {
  if (!moments?.length) return '';
  return moments
    .map((m) => {
      const head = m.orderLabel || m.prompt || 'Teaching moment';
      return `- **${head}:** ${String(m.answer || '').slice(0, 500)}`;
    })
    .join('\n');
}
