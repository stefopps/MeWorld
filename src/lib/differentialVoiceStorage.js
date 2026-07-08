import { recordingPublicUrl } from './caseUserLog.js';
import { STORAGE } from './storageKeys.js';

const DB_NAME = 'schoonmaker_diff_voice';
const STORE = 'recordings';

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
    const raw = localStorage.getItem(STORAGE.differentialVoiceIndex);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeIndex(map) {
  try {
    localStorage.setItem(STORAGE.differentialVoiceIndex, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export async function saveLocalDifferentialRecording(caseId, blob, meta = {}) {
  const id = `diff-voice-${caseId}-${Date.now()}`;
  const db = await openDb();
  const at = new Date().toISOString();
  const row = {
    id,
    caseId: String(caseId),
    at,
    durationMs: meta.durationMs || 0,
    transcript: meta.transcript || '',
    mimeType: blob.type || 'audio/webm',
    blob,
  };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(row);
  });
  const index = readIndex();
  const list = Array.isArray(index[String(caseId)]) ? index[String(caseId)] : [];
  list.unshift({
    id,
    localId: id,
    at,
    durationMs: row.durationMs,
    transcript: row.transcript,
    local: true,
    slot: list.length + 1,
  });
  index[String(caseId)] = list.slice(0, 50);
  writeIndex(index);
  return {
    id,
    slot: list.length,
    at,
    durationMs: row.durationMs,
    file: null,
    local: true,
    localId: id,
  };
}

export function listLocalDifferentialRecordings(caseId, { newestFirst = false } = {}) {
  const index = readIndex();
  const list = Array.isArray(index[String(caseId)]) ? index[String(caseId)] : [];
  const rows = list.map((rec) => ({
    ...rec,
    local: true,
    localId: rec.localId || rec.id,
  }));
  if (newestFirst) return rows;
  return [...rows].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
}

export async function getLocalDifferentialRecordingUrl(localId) {
  try {
    const db = await openDb();
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(localId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (!row) return '';
    const blob = row.blob instanceof Blob
      ? row.blob
      : row.bytes
        ? new Blob([row.bytes], { type: row.mimeType || 'audio/webm' })
        : null;
    if (!blob?.size) return '';
    return URL.createObjectURL(blob);
  } catch {
    return '';
  }
}

function recordingsLikelySame(a, b) {
  if (!a || !b) return false;
  if (a.slot && b.slot && a.slot === b.slot) return true;
  const ta = a.at ? new Date(a.at).getTime() : 0;
  const tb = b.at ? new Date(b.at).getTime() : 0;
  if (!ta || !tb) return false;
  const durationClose = Math.abs((a.durationMs || 0) - (b.durationMs || 0)) < 3000;
  return Math.abs(ta - tb) < 15000 && durationClose;
}

export function listAllDifferentialRecordings(caseId, serverData = null) {
  const local = listLocalDifferentialRecordings(caseId);
  let remote = [];
  if (serverData?.recordings?.length) {
    remote = serverData.recordings.map((r) => ({ ...r, local: false }));
  } else if (serverData?.sessions) {
    serverData.sessions.forEach((session) => {
      (session.recordings || []).forEach((rec) => {
        remote.push({ ...rec, sessionId: session.id, local: false });
      });
    });
  }
  const merged = [...local];
  for (const rec of remote) {
    if (!local.some((l) => recordingsLikelySame(l, rec))) {
      merged.push(rec);
    }
  }
  merged.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  return merged;
}

export function findServerRecordingFallback(caseId, localRec, serverData) {
  if (!serverData || !localRec || caseId == null || caseId === '') return null;
  const remote = listAllDifferentialRecordings(caseId, serverData).filter((r) => !r.local);
  return remote.find((r) => recordingsLikelySame(localRec, r)) || null;
}

/** Match a practice-log attempt to the closest saved voice note (by id or timestamp). */
export function findRecordingForAttempt(attempt, recordings = []) {
  if (!attempt || !recordings.length) return null;

  const recordingId = attempt.recordingId || attempt.voiceRecordingId || null;
  if (recordingId) {
    const byId = recordings.find(
      (r) => r.id === recordingId || r.localId === recordingId,
    );
    if (byId) return byId;
  }

  const tAttempt = attempt.at ? new Date(attempt.at).getTime() : 0;
  if (!tAttempt) return null;

  let best = null;
  let bestDelta = Infinity;
  for (const rec of recordings) {
    const tRec = rec.at ? new Date(rec.at).getTime() : 0;
    if (!tRec) continue;
    const delta = Math.abs(tAttempt - tRec);
    // Reveal may lag recording stop — prefer closest within 5 minutes.
    if (delta <= 5 * 60 * 1000 && delta < bestDelta) {
      bestDelta = delta;
      best = rec;
    }
  }
  return best;
}

export function localRecordingKey(rec) {
  return rec?.localId || rec?.id || '';
}

export function resolveRecordingPlaybackSrc(caseId, rec, localUrls, serverData) {
  if (!rec) return '';
  if (rec.local) {
    const key = localRecordingKey(rec);
    if (key && localUrls?.[key]) return localUrls[key];
    const remote = findServerRecordingFallback(caseId, rec, serverData);
    if (remote?.file) return recordingPublicUrl(remote.file);
    return '';
  }
  return recordingPublicUrl(rec.file);
}
