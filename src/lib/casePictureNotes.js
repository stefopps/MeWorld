import { appendCaseNotesBlock } from './caseNotes.js';
import { STORAGE } from './storageKeys.js';

const DB_NAME = 'schoonmaker_case_pictures';
const STORE = 'blobs';
const MAX_PICTURES_PER_CASE = 24;
const MAX_BYTES = 4 * 1024 * 1024;

const ROLES = new Set(['likeness', 'teach', 'reference']);

export const PICTURE_ROLE_OPTIONS = [
  { id: 'reference', label: 'Reference' },
  { id: 'teach', label: 'Teach-in' },
  { id: 'likeness', label: 'Likeness' },
];

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

function readIndexRoot() {
  try {
    const raw = localStorage.getItem(STORAGE.casePictureNotesIndex);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeIndexRoot(root) {
  try {
    localStorage.setItem(STORAGE.casePictureNotesIndex, JSON.stringify(root));
  } catch {
    /* quota */
  }
}

function normalizeRole(role) {
  const r = String(role || 'reference').toLowerCase();
  return ROLES.has(r) ? r : 'reference';
}

function roleLabel(role) {
  const opt = PICTURE_ROLE_OPTIONS.find((o) => o.id === normalizeRole(role));
  return opt?.label || 'Reference';
}

export { roleLabel as pictureRoleLabel };

/** Find picture metadata anywhere in the case index. */
export function findPictureNoteById(pictureId) {
  const pid = String(pictureId || '');
  if (!pid) return null;
  const root = readIndexRoot();
  for (const [caseId, bucket] of Object.entries(root)) {
    const pic = bucket?.pictures?.find((p) => p.id === pid);
    if (pic) return { caseId, ...pic };
  }
  return null;
}

/** Lightweight manifest — blobs live in IndexedDB only. */
export function listCasePictureNotes(caseId) {
  const id = String(caseId || '');
  if (!id) return [];
  const bucket = readIndexRoot()[id];
  if (!Array.isArray(bucket?.pictures)) return [];
  return [...bucket.pictures].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
}

export function casePictureLink(id) {
  return `casepic:${id}`;
}

export function appendPictureNoteJournalEntry(caseId, picture, { at = picture.at } = {}) {
  const link = casePictureLink(picture.id);
  const caption = String(picture.caption || '').trim();
  const role = roleLabel(picture.role);
  const body = caption
    ? `${caption}\n\nLink: ${link}`
    : `Attached for case work (${role.toLowerCase()}).\n\nLink: ${link}`;
  appendCaseNotesBlock(caseId, body, {
    header: `Picture · ${role}`,
    at,
  });
  return link;
}

export async function addCasePictureNote(
  caseId,
  fileOrBlob,
  { caption = '', role = 'reference', appendJournal = true } = {},
) {
  const caseKey = String(caseId || '');
  if (!caseKey) throw new Error('Missing case id');

  const blob =
    fileOrBlob instanceof Blob
      ? fileOrBlob
      : fileOrBlob?.type?.startsWith('image/')
        ? fileOrBlob
        : null;
  if (!blob || !blob.type?.startsWith('image/')) {
    throw new Error('Drop an image file (PNG, JPG, …)');
  }
  if (blob.size > MAX_BYTES) {
    throw new Error('Image too large — use under 4 MB');
  }

  const root = readIndexRoot();
  const bucket = root[caseKey] || { pictures: [] };
  const pictures = Array.isArray(bucket.pictures) ? [...bucket.pictures] : [];
  if (pictures.length >= MAX_PICTURES_PER_CASE) {
    throw new Error(`Max ${MAX_PICTURES_PER_CASE} pictures per case`);
  }

  const at = new Date().toISOString();
  const id = `pic-${caseKey}-${Date.now()}`;
  const entry = {
    id,
    at,
    caption: String(caption || '').trim(),
    role: normalizeRole(role),
    mimeType: blob.type || 'image/png',
  };

  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put({ id, caseId: caseKey, mimeType: entry.mimeType, blob, at });
  });

  pictures.push(entry);
  root[caseKey] = { pictures, updatedAt: at };
  writeIndexRoot(root);

  if (appendJournal) appendPictureNoteJournalEntry(caseKey, entry);

  return entry;
}

/** Change role on an existing picture note (reference ↔ likeness ↔ teach-in). */
export function updateCasePictureNoteRole(caseId, pictureId, role) {
  const caseKey = String(caseId || '');
  const pid = String(pictureId || '');
  const nextRole = normalizeRole(role);
  const root = readIndexRoot();
  const bucket = root[caseKey];
  if (!bucket?.pictures?.length) return false;

  let changed = false;
  const pictures = bucket.pictures.map((p) => {
    if (p.id !== pid) return p;
    if (p.role === nextRole) return p;
    changed = true;
    return { ...p, role: nextRole };
  });
  if (!changed) return false;

  root[caseKey] = { ...bucket, pictures, updatedAt: new Date().toISOString() };
  writeIndexRoot(root);
  return true;
}

export async function removeCasePictureNote(caseId, pictureId) {
  const caseKey = String(caseId || '');
  const pid = String(pictureId || '');
  if (!caseKey || !pid) return false;

  const root = readIndexRoot();
  const bucket = root[caseKey];
  if (!bucket?.pictures?.length) return false;
  const next = bucket.pictures.filter((p) => p.id !== pid);
  if (next.length === bucket.pictures.length) return false;

  root[caseKey] = { ...bucket, pictures: next, updatedAt: new Date().toISOString() };
  writeIndexRoot(root);

  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(pid);
  });
  return true;
}

export async function getCasePictureNoteUrl(pictureId) {
  const id = String(pictureId || '');
  if (!id) return '';
  try {
    const db = await openDb();
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    const blob =
      row?.blob instanceof Blob
        ? row.blob
        : row?.bytes
          ? new Blob([row.bytes], { type: row.mimeType || 'image/png' })
          : null;
    if (!blob?.size) return '';
    return URL.createObjectURL(blob);
  } catch {
    return '';
  }
}

/** One-time: legacy single mnemonic image → first picture note entry. */
export async function migrateLegacyCaseMemoryImage(caseId, legacyBlob, { mimeType = 'image/png' } = {}) {
  if (!legacyBlob?.size || !caseId) return null;
  const existing = listCasePictureNotes(caseId);
  if (existing.some((p) => p.role === 'likeness')) return null;
  return addCasePictureNote(caseId, legacyBlob, {
    caption: 'Imported memory hook image',
    role: 'likeness',
    appendJournal: false,
  });
}

export function summarizePictureNotesForChat(caseId) {
  return listCasePictureNotes(caseId).map((p) => ({
    link: casePictureLink(p.id),
    role: p.role,
    caption: p.caption || null,
    at: p.at,
    mimeType: p.mimeType,
  }));
}
