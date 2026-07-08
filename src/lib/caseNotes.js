import { STORAGE } from './storageKeys.js';
import { apiUrl, getApiBase } from './apiBase.js';

const PER_CASE_MAX_CHARS = 200_000;
const PERSIST_DEBOUNCE_MS = 900;

/** In-memory buffer — active case only; never all 181 cases in localStorage. */
const memoryCache = new Map();
const hydrated = new Set();
const persistTimers = new Map();
let activeCaseId = null;

function caseKey(caseId) {
  return String(caseId);
}

function perCaseFallbackKey(caseId) {
  return `${STORAGE.caseNotes}_${caseKey(caseId)}`;
}

function readNotesIndex() {
  try {
    const raw = localStorage.getItem(STORAGE.caseNotesIndex);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeNotesIndex(index) {
  try {
    localStorage.setItem(STORAGE.caseNotesIndex, JSON.stringify(index));
  } catch {
    /* index stays tiny — ignore */
  }
}

function touchNotesIndex(caseId, href) {
  const id = caseKey(caseId);
  const index = readNotesIndex();
  index[id] = {
    href: href || index[id]?.href || `cases/notes/${id.padStart(3, '0')}.md`,
    updatedAt: new Date().toISOString(),
  };
  writeNotesIndex(index);
}

function setMemoryCache(caseId, text) {
  const id = caseKey(caseId);
  if (activeCaseId && activeCaseId !== id) {
    memoryCache.delete(activeCaseId);
    hydrated.delete(activeCaseId);
  }
  activeCaseId = id;
  memoryCache.set(id, String(text || ''));
}

function trimNotesToMax(text, maxChars) {
  const raw = String(text || '');
  if (raw.length <= maxChars) return raw;
  const parts = raw.split(/\n---\n/);
  while (parts.length > 1 && parts.join('\n---\n').length > maxChars) {
    parts.shift();
  }
  const next = parts.join('\n---\n');
  return next.length > maxChars ? next.slice(-maxChars) : next;
}

function writeFallback(caseId, text) {
  try {
    const trimmed = trimNotesToMax(text, PER_CASE_MAX_CHARS);
    localStorage.setItem(perCaseFallbackKey(caseId), trimmed);
  } catch {
    /* quota — drop oldest blocks */
    try {
      localStorage.setItem(perCaseFallbackKey(caseId), trimNotesToMax(text, PER_CASE_MAX_CHARS / 2));
    } catch {
      /* ignore */
    }
  }
}

async function apiNotes(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const r = await fetch(apiUrl(path), {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
      signal: controller.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function persistFullNotes(caseId, text) {
  const id = caseKey(caseId);
  if (!id) return;
  try {
    const data = await apiNotes(`/api/user/case/${encodeURIComponent(id)}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ text: String(text || '') }),
    });
    if (data.href) touchNotesIndex(id, data.href);
    try {
      localStorage.removeItem(perCaseFallbackKey(id));
    } catch {
      /* ignore */
    }
  } catch {
    writeFallback(id, text);
    touchNotesIndex(id);
  }
}

function schedulePersist(caseId, text) {
  const id = caseKey(caseId);
  const prev = persistTimers.get(id);
  if (prev) clearTimeout(prev);
  persistTimers.set(
    id,
    setTimeout(() => {
      persistTimers.delete(id);
      void persistFullNotes(id, text);
    }, PERSIST_DEBOUNCE_MS),
  );
}

async function persistAppend(caseId, body, { header = 'Note', at = null } = {}) {
  const id = caseKey(caseId);
  try {
    const data = await apiNotes(`/api/user/case/${encodeURIComponent(id)}/notes/append`, {
      method: 'POST',
      body: JSON.stringify({ body, header, at }),
    });
    if (data.href) touchNotesIndex(id, data.href);
    try {
      localStorage.removeItem(perCaseFallbackKey(id));
    } catch {
      /* ignore */
    }
    return true;
  } catch {
    return false;
  }
}

function readLegacyAllNotes() {
  try {
    const raw = localStorage.getItem(STORAGE.caseNotes);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** One-time: move monolithic localStorage blob to per-case files on disk. */
export async function migrateAllLegacyCaseNotes() {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(STORAGE.caseNotesMigrated) === '1') return;

  const legacy = readLegacyAllNotes();
  const ids = Object.keys(legacy);
  for (const caseId of ids) {
    const text = legacy[caseId];
    if (typeof text !== 'string' || !text.trim()) continue;
    try {
      await apiNotes(`/api/user/case/${encodeURIComponent(caseId)}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ text }),
        timeoutMs: 15000,
      });
      touchNotesIndex(caseId);
    } catch {
      writeFallback(caseId, text);
    }
  }

  try {
    localStorage.removeItem(STORAGE.caseNotes);
    localStorage.setItem(STORAGE.caseNotesMigrated, '1');
  } catch {
    /* ignore */
  }
}

export function caseNotesPublicUrl(caseId) {
  const id = caseKey(caseId);
  const href = readNotesIndex()[id]?.href;
  if (!href) return '';
  const path = href.replace(/^\/+/, '');
  const base = getApiBase();
  return base ? `${base}/user-data/${path}` : `/user-data/${path}`;
}

/** Load this case's notes from disk into memory (per case — not the whole bank). */
export async function hydrateCaseNotes(caseId) {
  if (caseId == null || caseId === '') return '';
  const id = caseKey(caseId);

  if (hydrated.has(id) && memoryCache.has(id)) {
    activeCaseId = id;
    return memoryCache.get(id) || '';
  }

  await migrateAllLegacyCaseNotes();

  const legacy = readLegacyAllNotes();
  if (typeof legacy[id] === 'string' && legacy[id].trim()) {
    setMemoryCache(id, legacy[id]);
    void persistFullNotes(id, legacy[id]);
  }

  try {
    const data = await apiNotes(`/api/user/case/${encodeURIComponent(id)}/notes`, { timeoutMs: 6000 });
    setMemoryCache(id, data.text || '');
    if (data.href) touchNotesIndex(id, data.href);
    hydrated.add(id);
    return data.text || '';
  } catch {
    try {
      const fb = localStorage.getItem(perCaseFallbackKey(id));
      if (fb != null) {
        setMemoryCache(id, fb);
        hydrated.add(id);
        return fb;
      }
    } catch {
      /* ignore */
    }
    setMemoryCache(id, memoryCache.get(id) || '');
    hydrated.add(id);
    return memoryCache.get(id) || '';
  }
}

export function releaseCaseNotesCache(caseId) {
  const id = caseKey(caseId);
  memoryCache.delete(id);
  hydrated.delete(id);
  const t = persistTimers.get(id);
  if (t) clearTimeout(t);
  persistTimers.delete(id);
  if (activeCaseId === id) activeCaseId = null;
}

/** Parse timestamp from a note block header (last segment after ·). */
export function parseNoteBlockTimestamp(header = '') {
  const parts = String(header || '')
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const parsed = Date.parse(parts[i]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/** Sync read from in-memory buffer for the active case (call hydrateCaseNotes first). */
export function readCaseNotes(caseId) {
  if (caseId == null || caseId === '') return '';
  return memoryCache.get(caseKey(caseId)) || '';
}

export function writeCaseNotes(caseId, text) {
  if (caseId == null || caseId === '') return;
  const trimmed = String(text || '');
  if (!trimmed.trim()) {
    setMemoryCache(caseId, '');
    schedulePersist(caseId, '');
    return;
  }
  setMemoryCache(caseId, trimmed);
  touchNotesIndex(caseId);
  schedulePersist(caseId, trimmed);
}

/** Split journal blob into blocks; oldest first, newest (current) last. */
export function parseCaseNoteBlocks(caseId) {
  const raw = readCaseNotes(caseId).trim();
  if (!raw) return [];
  if (!raw.includes('\n---\n')) {
    return [{ content: raw, header: 'Notes', sortAt: 0 }];
  }
  const blocks = raw
    .split(/\n---\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => {
      const headerMatch = chunk.match(/^\*\*(.+?)\*\*\s*\n?([\s\S]*)$/);
      if (headerMatch) {
        const header = headerMatch[1];
        return {
          header,
          content: headerMatch[2].trim(),
          sortAt: parseNoteBlockTimestamp(header) || index,
        };
      }
      return { header: 'Note', content: chunk, sortAt: index };
    })
    .filter((b) => b.content);

  return [...blocks].sort((a, b) => a.sortAt - b.sortAt || 0);
}

/** Rewrite stored notes so hearing/note blocks are chronological (current last). */
export function reorderCaseNotesChronologically(caseId) {
  const blocks = parseCaseNoteBlocks(caseId);
  if (blocks.length < 2) return false;
  const body = blocks
    .map((b) => `**${b.header}**\n${b.content}`)
    .join('\n\n---\n');
  const current = readCaseNotes(caseId).trim();
  if (body === current) return false;
  writeCaseNotes(caseId, body);
  return true;
}

export function appendCaseNotesBlock(caseId, text, { header = 'Note', at = null } = {}) {
  const body = String(text || '').trim();
  if (!body || caseId == null || caseId === '') return;
  const when = at ? new Date(at) : new Date();
  const stamp = when.toLocaleString();
  const existing = readCaseNotes(caseId);
  const entry = `\n\n---\n**${header} · ${stamp}**\n${body}\n`;
  const next = `${existing}${entry}`.trimStart();
  setMemoryCache(caseId, next);
  touchNotesIndex(caseId);
  void persistAppend(caseId, body, { header, at: when.toISOString() }).then((ok) => {
    if (!ok) schedulePersist(caseId, next);
  });
  reorderCaseNotesChronologically(caseId);
}

export function hasCaseNotes(caseId) {
  return Boolean(readCaseNotes(caseId).trim());
}
