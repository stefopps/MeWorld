import { appendCaseNotesBlock, reorderCaseNotesChronologically } from './caseNotes.js';
import {
  readCaseTranscriptArchive,
  readDifferentialLog,
} from './differentialPracticeLog.js';
import { listLocalDifferentialRecordings } from './differentialVoiceStorage.js';
import { STORAGE } from './storageKeys.js';

function readSyncMap() {
  try {
    const raw = localStorage.getItem(STORAGE.differentialNotesSync);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeSyncMap(map) {
  try {
    localStorage.setItem(STORAGE.differentialNotesSync, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

function isSynced(caseId, syncKey) {
  if (!syncKey) return false;
  const list = readSyncMap()[String(caseId)];
  return Array.isArray(list) && list.includes(syncKey);
}

function markSynced(caseId, syncKey) {
  if (!syncKey || caseId == null) return;
  const id = String(caseId);
  const map = readSyncMap();
  const list = Array.isArray(map[id]) ? map[id] : [];
  if (list.includes(syncKey)) return;
  map[id] = [...list, syncKey];
  writeSyncMap(map);
}

export function formatDifferentialHearingBody({ raw = '', cleaned = '' } = {}) {
  const hearing = String(raw || '').trim();
  const clean = String(cleaned || '').trim();
  const parts = [];
  if (clean) parts.push(`Cleaned:\n${clean}`);
  if (hearing && hearing !== clean) parts.push(`Raw hearing:\n${hearing}`);
  if (!parts.length && hearing) parts.push(`Raw hearing:\n${hearing}`);
  return parts.join('\n\n');
}

/** Append cleaned + raw differential hearing to the case notes journal (tutor chat context). */
export function appendDifferentialHearingNote(
  caseId,
  { cleaned = '', raw = '', topic = '', at = null, syncKey = null } = {},
) {
  if (caseId == null || caseId === '') return false;
  if (syncKey && isSynced(caseId, syncKey)) return false;

  const body = formatDifferentialHearingBody({ raw, cleaned });
  if (!body) return false;

  const topicBit = topic ? ` · ${topic}` : '';
  appendCaseNotesBlock(caseId, body, {
    header: `Differential hearing${topicBit}`,
    at,
  });
  if (syncKey) markSynced(caseId, syncKey);
  return true;
}

function collectHearingHistory(caseId) {
  const id = String(caseId);
  const rows = [];
  const seen = new Set();

  const push = (row) => {
    const raw = String(row.raw || '').trim();
    const cleaned = String(row.cleaned || '').trim();
    if (!raw && !cleaned) return;
    const dedupe = `${row.at || ''}|${cleaned.slice(0, 160)}|${raw.slice(0, 160)}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    rows.push({
      at: row.at || null,
      raw,
      cleaned,
      topic: row.topic || '',
      syncKey: row.syncKey || dedupe,
    });
  };

  for (const attempt of readDifferentialLog().attempts) {
    if (String(attempt.caseId) !== id) continue;
    push({
      at: attempt.at,
      raw: attempt.rawTranscript,
      cleaned: attempt.cleanedTranscript,
      topic: attempt.topic,
      syncKey: attempt.id ? `log:${attempt.id}` : `log:${attempt.at}`,
    });
  }

  const archiveBucket = readCaseTranscriptArchive().cases[id];
  for (const attempt of archiveBucket?.attempts || []) {
    push({
      at: attempt.at,
      raw: attempt.rawTranscript,
      cleaned: attempt.cleanedTranscript,
      topic: archiveBucket.topic,
      syncKey: `archive:${attempt.at}:${(attempt.cleanedTranscript || attempt.rawTranscript || '').slice(0, 40)}`,
    });
  }

  for (const rec of listLocalDifferentialRecordings(caseId)) {
    const transcript = String(rec.transcript || '').trim();
    if (!transcript) continue;
    push({
      at: rec.at,
      raw: transcript,
      cleaned: '',
      topic: '',
      syncKey: `voice:${rec.localId || rec.id}`,
    });
  }

  rows.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  return rows;
}

/** Backfill Notes tab from practice log, transcript archive, and voice index JSON. */
export function syncHistoricalHearingsToCaseNotes(caseId) {
  if (caseId == null || caseId === '') return 0;
  let added = 0;
  for (const row of collectHearingHistory(caseId)) {
    const ok = appendDifferentialHearingNote(caseId, row);
    if (ok) added += 1;
  }
  reorderCaseNotesChronologically(caseId);
  return added;
}
