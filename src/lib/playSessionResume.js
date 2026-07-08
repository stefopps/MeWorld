import { STORAGE } from './storageKeys.js';

const CHECKPOINT_VERSION = 1;
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;

function emptyCheckpoint() {
  return null;
}

export function readPlayCheckpoint() {
  try {
    const raw = localStorage.getItem(STORAGE.activePlayCheckpoint);
    if (!raw) return emptyCheckpoint();
    const parsed = JSON.parse(raw);
    if (!parsed?.caseId || parsed.version !== CHECKPOINT_VERSION) return emptyCheckpoint();
    if (parsed.savedAt) {
      const age = Date.now() - new Date(parsed.savedAt).getTime();
      if (age > MAX_AGE_MS) {
        clearPlayCheckpoint();
        return emptyCheckpoint();
      }
    }
    return parsed;
  } catch {
    return emptyCheckpoint();
  }
}

export function writePlayCheckpoint(payload) {
  if (!payload?.caseId) return null;
  try {
    const next = {
      version: CHECKPOINT_VERSION,
      savedAt: new Date().toISOString(),
      ...payload,
      caseId: String(payload.caseId),
    };
    localStorage.setItem(STORAGE.activePlayCheckpoint, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function clearPlayCheckpoint() {
  try {
    localStorage.removeItem(STORAGE.activePlayCheckpoint);
  } catch {
    /* ignore */
  }
}

function readCaseCheckpointMap() {
  try {
    const raw = localStorage.getItem(STORAGE.casePlayCheckpoints);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCaseCheckpointMap(map) {
  try {
    localStorage.setItem(STORAGE.casePlayCheckpoints, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Per-case saved play state — survives "next case" navigation. */
export function writeCasePlayCheckpoint(caseId, payload) {
  if (caseId == null || caseId === '' || !payload) return null;
  const id = String(caseId);
  const map = readCaseCheckpointMap();
  const next = {
    version: CHECKPOINT_VERSION,
    savedAt: new Date().toISOString(),
    ...payload,
    caseId: id,
  };
  map[id] = next;
  writeCaseCheckpointMap(map);
  return next;
}

export function readCasePlayCheckpoint(caseId) {
  if (caseId == null || caseId === '') return null;
  const row = readCaseCheckpointMap()[String(caseId)];
  if (!row || row.version !== CHECKPOINT_VERSION) return null;
  if (row.savedAt) {
    const age = Date.now() - new Date(row.savedAt).getTime();
    if (age > MAX_AGE_MS) {
      clearCasePlayCheckpoint(caseId);
      return null;
    }
  }
  return row;
}

export function clearCasePlayCheckpoint(caseId) {
  if (caseId == null || caseId === '') return;
  const id = String(caseId);
  const map = readCaseCheckpointMap();
  if (!map[id]) return;
  delete map[id];
  writeCaseCheckpointMap(map);
}

export function listCasePlayCheckpointIds() {
  return Object.keys(readCaseCheckpointMap());
}

export function hasPlayCheckpoint() {
  return Boolean(readPlayCheckpoint()?.caseId);
}

export function hydrateCheckpointTimer(checkpoint, timerTotal) {
  if (!checkpoint?.checkpoint) return null;
  const c = checkpoint.checkpoint;
  let timeLeft = typeof c.timeLeft === 'number' ? c.timeLeft : timerTotal;
  if (!c.timerPaused && checkpoint.savedAt) {
    const elapsedSec = Math.floor((Date.now() - new Date(checkpoint.savedAt).getTime()) / 1000);
    if (elapsedSec > 0) timeLeft = Math.max(0, timeLeft - elapsedSec);
  }
  return { ...c, timeLeft };
}

export function formatPlayCheckpointSummary(checkpoint, caseMeta = {}) {
  if (!checkpoint) return null;
  const c = checkpoint.checkpoint || {};
  const placed = c.placedCount ?? Object.keys(c.placed || {}).length;
  const total = c.total ?? '?';
  const title = caseMeta.title || checkpoint.caseTitle || `Case ${checkpoint.caseNumber || checkpoint.caseId}`;
  const minutes = Math.floor((c.timeLeft || 0) / 60);
  const seconds = (c.timeLeft || 0) % 60;
  const timerText =
    typeof c.timeLeft === 'number'
      ? `${minutes}:${String(seconds).padStart(2, '0')} left`
      : 'timer saved';
  const when = checkpoint.savedAt
    ? new Date(checkpoint.savedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';
  return {
    title,
    placed,
    total,
    timerText,
    when,
    line: `${title} · ${placed}/${total} placed · ${timerText}`,
  };
}
