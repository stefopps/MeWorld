import { STORAGE } from './storageKeys.js';
import { readCaseNotes, writeCaseNotes } from './caseNotes.js';
import {
  addCasePictureNote,
  getCasePictureNoteUrl,
  listCasePictureNotes,
  migrateLegacyCaseMemoryImage,
  removeCasePictureNote,
} from './casePictureNotes.js';

const DB_NAME = 'schoonmaker_diff_memory';
const STORE = 'images';

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

function readIndex() {
  try {
    const raw = localStorage.getItem(STORAGE.differentialCaseMemory);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeIndex(map) {
  try {
    localStorage.setItem(STORAGE.differentialCaseMemory, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function readCaseMemoryMeta(caseId) {
  const id = String(caseId);
  const row = readIndex()[id] || {};
  let text = readCaseNotes(id).trim();
  // One-time migrate legacy differential-only mnemonic text into shared case notes.
  if (!text && row.text?.trim()) {
    text = row.text.trim();
    writeCaseNotes(id, text);
    const index = readIndex();
    if (index[id]) {
      index[id] = { ...index[id], text: '', updatedAt: new Date().toISOString() };
      writeIndex(index);
    }
  }
  return {
    text,
    hasImage: Boolean(row.imageId) || listCasePictureNotes(id).length > 0,
    updatedAt: row.updatedAt || null,
  };
}

export function writeCaseMemoryText(caseId, text) {
  const id = String(caseId);
  const body = String(text || '');
  writeCaseNotes(id, body);
  const index = readIndex();
  const prev = index[id] || {};
  index[id] = {
    ...prev,
    text: '',
    updatedAt: new Date().toISOString(),
  };
  writeIndex(index);
  return index[id];
}

export async function saveCaseMemoryImage(caseId, blob) {
  await addCasePictureNote(caseId, blob, { role: 'reference', appendJournal: true });
  return null;
}

async function deleteCaseMemoryImageBlob(imageId) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(imageId);
  });
}

export async function getCaseMemoryImageUrl(caseId) {
  const pictures = listCasePictureNotes(caseId);
  if (pictures.length) {
    return getCasePictureNoteUrl(pictures[pictures.length - 1].id);
  }
  const row = readIndex()[String(caseId)];
  if (!row?.imageId) return '';
  const db = await openDb();
  const stored = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(row.imageId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  if (!stored?.blob) return '';
  return URL.createObjectURL(stored.blob);
}

export async function clearCaseMemoryImage(caseId) {
  const id = String(caseId);
  for (const pic of listCasePictureNotes(id)) {
    await removeCasePictureNote(id, pic.id);
  }
  const index = readIndex();
  const prev = index[id];
  if (prev?.imageId) await deleteCaseMemoryImageBlob(prev.imageId);
  if (!prev && !listCasePictureNotes(id).length) return;
  index[id] = { ...prev, imageId: null, updatedAt: new Date().toISOString() };
  writeIndex(index);
}

export async function ensureLegacyMemoryImageMigrated(caseId) {
  const id = String(caseId);
  const row = readIndex()[id];
  if (!row?.imageId) return false;
  try {
    const db = await openDb();
    const stored = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(row.imageId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    const blob =
      stored?.blob instanceof Blob
        ? stored.blob
        : stored?.bytes
          ? new Blob([stored.bytes], { type: stored.mimeType || 'image/png' })
          : null;
    if (!blob?.size) return false;
    await migrateLegacyCaseMemoryImage(id, blob, { mimeType: stored.mimeType });
    await deleteCaseMemoryImageBlob(row.imageId);
    const index = readIndex();
    if (index[id]) {
      index[id] = { ...index[id], imageId: null, updatedAt: new Date().toISOString() };
      writeIndex(index);
    }
    return true;
  } catch {
    return false;
  }
}
