import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_ROOT = path.join(__dirname, '../user-data');
const USER_CASES_DIR = path.join(USER_ROOT, 'cases');
const USER_NOTES_DIR = path.join(USER_CASES_DIR, 'notes');
const USER_RECORDINGS_DIR = path.join(USER_ROOT, 'recordings');

export function ensureUserDirs() {
  for (const dir of [USER_ROOT, USER_CASES_DIR, USER_NOTES_DIR, USER_RECORDINGS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function notesFilePath(caseId) {
  return path.join(USER_NOTES_DIR, `${String(caseId).padStart(3, '0')}.md`);
}

function notesPublicHref(caseId) {
  return `cases/notes/${String(caseId).padStart(3, '0')}.md`;
}

export async function readCaseNotesText(caseId) {
  ensureUserDirs();
  try {
    return await fsp.readFile(notesFilePath(caseId), 'utf8');
  } catch {
    return '';
  }
}

export async function writeCaseNotesText(caseId, text, { allowClear = false } = {}) {
  ensureUserDirs();
  const trimmed = String(text || '');
  const fp = notesFilePath(caseId);
  let existing = '';
  try {
    existing = await fsp.readFile(fp, 'utf8');
  } catch {
    existing = '';
  }
  if (!allowClear && existing.trim() && !trimmed.trim()) {
    const stat = await fsp.stat(fp);
    return {
      text: existing,
      href: notesPublicHref(caseId),
      bytes: stat.size,
      updatedAt: new Date().toISOString(),
      preserved: true,
    };
  }
  if (!trimmed.trim()) {
    try {
      await fsp.unlink(fp);
    } catch {
      /* missing file */
    }
    return { text: '', href: null, bytes: 0 };
  }
  await fsp.writeFile(fp, trimmed, 'utf8');
  const stat = await fsp.stat(fp);
  return {
    text: trimmed,
    href: notesPublicHref(caseId),
    bytes: stat.size,
    updatedAt: new Date().toISOString(),
  };
}

/** Append one journal block without reading the full file into memory. */
export async function appendCaseNotesBlockText(caseId, body, { header = 'Note', at = null } = {}) {
  const content = String(body || '').trim();
  if (!content) return null;
  ensureUserDirs();
  const fp = notesFilePath(caseId);
  const when = at ? new Date(at) : new Date();
  const stamp = when.toLocaleString();
  const block = `\n\n---\n**${header} · ${stamp}**\n${content}\n`;
  let exists = false;
  try {
    await fsp.access(fp);
    exists = true;
  } catch {
    exists = false;
  }
  if (!exists) {
    await fsp.writeFile(fp, block.trimStart(), 'utf8');
  } else {
    await fsp.appendFile(fp, block, 'utf8');
  }
  const stat = await fsp.stat(fp);
  return {
    href: notesPublicHref(caseId),
    bytes: stat.size,
    updatedAt: new Date().toISOString(),
  };
}

function caseFilePath(caseId) {
  return path.join(USER_CASES_DIR, `${String(caseId).padStart(3, '0')}.json`);
}

function caseLiveDir(caseId) {
  return path.join(USER_CASES_DIR, String(caseId).padStart(3, '0'), 'live');
}

/** Rolling snapshot — `cases/143/live/snapshot.json` mirrors active work for one case. */
async function writeCaseLiveSnapshot(caseId, data) {
  try {
    const dir = caseLiveDir(caseId);
    await fsp.mkdir(dir, { recursive: true });
    const snapshot = {
      caseId: String(caseId),
      updatedAt: new Date().toISOString(),
      title: data.title || '',
      stats: data.stats || {},
      chatMessages: data.stats?.chatMessages ?? (data.chatHistory?.length || 0),
      chatTail: (data.chatHistory || []).slice(-40),
      openSessions: (data.sessions || []).filter((s) => !s.endedAt).map((s) => ({
        id: s.id,
        startedAt: s.startedAt,
        attempt: s.attempt,
      })),
      lastSession: (data.sessions || []).length
        ? data.sessions[data.sessions.length - 1]
        : null,
    };
    await fsp.writeFile(
      path.join(dir, 'snapshot.json'),
      JSON.stringify(snapshot, null, 2),
      'utf8',
    );
  } catch {
    /* non-fatal */
  }
}

function defaultCaseUser(caseId, meta = {}) {
  return {
    caseId: String(caseId),
    caseNumber: meta.caseNumber ?? caseId,
    title: meta.title || '',
    diagnosis: meta.diagnosis || null,
    updatedAt: new Date().toISOString(),
    stats: {
      sessions: 0,
      chatMessages: 0,
      recordings: 0,
      noteEvents: 0,
      stacksPlaced: 0,
      bestAccuracy: 0,
      lastPlayedAt: null,
    },
    chatHistory: [],
    recordings: [],
    sessions: [],
  };
}

/** Gather recordings stored on individual play sessions (legacy layout). */
function collectSessionRecordings(data) {
  const rows = [];
  for (const session of data.sessions || []) {
    for (const rec of session.recordings || []) {
      rows.push({
        ...rec,
        sessionId: rec.sessionId || session.id,
        attempt: session.attempt,
      });
    }
  }
  rows.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  return rows;
}

/** Ensure case-level append-only recording slots (never overwrite prior entries). */
export function ensureCaseRecordings(data) {
  if (!data) return { data, changed: false };
  let changed = false;

  if (!Array.isArray(data.recordings)) {
    data.recordings = [];
    changed = true;
  }

  const knownIds = new Set(data.recordings.map((rec) => rec.id).filter(Boolean));
  for (const legacy of collectSessionRecordings(data)) {
    if (legacy.id && knownIds.has(legacy.id)) continue;
    data.recordings.push(legacy);
    if (legacy.id) knownIds.add(legacy.id);
    changed = true;
  }

  data.recordings.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  data.recordings.forEach((rec, index) => {
    const slot = index + 1;
    if (rec.slot !== slot) {
      rec.slot = slot;
      changed = true;
    }
  });

  const count = data.recordings.length;
  if ((data.stats?.recordings || 0) !== count) {
    data.stats.recordings = count;
    changed = true;
  }

  return { data, changed };
}

export async function readCaseUser(caseId, { migrate = false } = {}) {
  ensureUserDirs();
  try {
    const raw = await fsp.readFile(caseFilePath(caseId), 'utf8');
    const data = JSON.parse(raw);
    const { data: normalized, changed } = ensureCaseRecordings(data);
    if (migrate && changed) {
      await writeCaseUser(caseId, normalized);
    }
    return normalized;
  } catch {
    return null;
  }
}

export async function writeCaseUser(caseId, data) {
  ensureUserDirs();
  const next = { ...data, updatedAt: new Date().toISOString() };
  await fsp.writeFile(caseFilePath(caseId), JSON.stringify(next, null, 2), 'utf8');
  await writeCaseLiveSnapshot(caseId, next);
  return next;
}

export async function getOrCreateCaseUser(caseId, meta = {}) {
  let data = (await readCaseUser(caseId)) || defaultCaseUser(caseId, meta);
  if (meta.title) data.title = meta.title;
  if (meta.caseNumber != null) data.caseNumber = meta.caseNumber;
  if (meta.diagnosis != null) data.diagnosis = meta.diagnosis;
  return data;
}

export async function startCaseSession(caseId, meta = {}) {
  const data = await getOrCreateCaseUser(caseId, meta);
  const sessionId = crypto.randomBytes(12).toString('hex');
  const startedAt = new Date().toISOString();
  const session = {
    id: sessionId,
    startedAt,
    endedAt: null,
    attempt: data.sessions.length + 1,
    result: null,
    timeline: [{ at: startedAt, type: 'session_start', attempt: data.sessions.length + 1 }],
    recordings: [],
  };
  data.sessions.push(session);
  data.stats.sessions = data.sessions.length;
  data.stats.lastPlayedAt = startedAt;
  await writeCaseUser(caseId, data);
  return { sessionId, attempt: session.attempt, session, data };
}

export async function appendTimelineEvent(caseId, sessionId, event = {}) {
  const data = await readCaseUser(caseId);
  if (!data) return null;
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const entry = { at: new Date().toISOString(), ...event };
  session.timeline.push(entry);
  if (event.type === 'note') data.stats.noteEvents = (data.stats.noteEvents || 0) + 1;
  if (event.type === 'stack') data.stats.stacksPlaced = (data.stats.stacksPlaced || 0) + 1;
  await writeCaseUser(caseId, data);
  return entry;
}

export async function appendChatHistory(caseId, sessionId, role, content) {
  const data = await getOrCreateCaseUser(caseId);
  const msg = {
    at: new Date().toISOString(),
    sessionId: sessionId || null,
    role,
    content: String(content || ''),
  };
  if (!Array.isArray(data.chatHistory)) data.chatHistory = [];
  data.chatHistory.push(msg);
  data.stats.chatMessages = data.chatHistory.length;
  if (sessionId) {
    const session = data.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.timeline.push({ at: msg.at, type: 'chat', role, text: msg.content });
    }
  }
  await writeCaseUser(caseId, data);
  return msg;
}

export async function endCaseSession(caseId, sessionId, result = {}) {
  const data = await readCaseUser(caseId);
  if (!data) return null;
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session || session.endedAt) return session;
  session.endedAt = new Date().toISOString();
  session.result = result;
  session.timeline.push({ at: session.endedAt, type: 'session_end', result });
  if (result.accuracy != null) {
    data.stats.bestAccuracy = Math.max(data.stats.bestAccuracy || 0, Number(result.accuracy) || 0);
  }
  data.stats.lastPlayedAt = session.endedAt;
  await writeCaseUser(caseId, data);
  return session;
}

export async function saveRecording(caseId, sessionId, buffer, { durationMs, mimeType }) {
  ensureUserDirs();
  const recId = crypto.randomBytes(8).toString('hex');
  const caseDir = path.join(USER_RECORDINGS_DIR, String(caseId).padStart(3, '0'));
  if (!fs.existsSync(caseDir)) fs.mkdirSync(caseDir, { recursive: true });
  const ext = mimeType?.includes('mp4') ? 'mp4' : 'webm';
  const filename = `${recId}.${ext}`;
  const relPath = `recordings/${String(caseId).padStart(3, '0')}/${filename}`;
  await fsp.writeFile(path.join(caseDir, filename), buffer);

  const data = await getOrCreateCaseUser(caseId);
  ensureCaseRecordings(data);

  const slot = data.recordings.length + 1;
  const rec = {
    id: recId,
    slot,
    at: new Date().toISOString(),
    durationMs: durationMs || 0,
    mimeType: mimeType || 'audio/webm',
    file: relPath,
    sessionId: sessionId || null,
  };

  data.recordings.push(rec);

  let session = data.sessions.find((s) => s.id === sessionId);
  if (!session) {
    session =
      [...(data.sessions || [])].reverse().find((s) => !s.endedAt) ||
      data.sessions[data.sessions.length - 1] ||
      null;
  }
  if (session) {
    if (!Array.isArray(session.recordings)) session.recordings = [];
    session.recordings.push({
      id: rec.id,
      slot: rec.slot,
      at: rec.at,
      durationMs: rec.durationMs,
      mimeType: rec.mimeType,
      file: rec.file,
    });
    session.timeline.push({
      at: rec.at,
      type: 'recording',
      recordingId: recId,
      slot: rec.slot,
      durationMs: rec.durationMs,
      file: relPath,
    });
  }

  data.stats.recordings = data.recordings.length;
  await writeCaseUser(caseId, data);
  return rec;
}

export async function getOverallStats() {
  ensureUserDirs();
  let files = [];
  try {
    files = await fsp.readdir(USER_CASES_DIR);
  } catch {
    return {
      casesWithData: 0,
      totalSessions: 0,
      totalChatMessages: 0,
      totalRecordings: 0,
      totalNoteEvents: 0,
      totalStacksPlaced: 0,
      lastPlayedAt: null,
    };
  }

  const agg = {
    casesWithData: 0,
    totalSessions: 0,
    totalChatMessages: 0,
    totalRecordings: 0,
    totalNoteEvents: 0,
    totalStacksPlaced: 0,
    lastPlayedAt: null,
  };

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(await fsp.readFile(path.join(USER_CASES_DIR, file), 'utf8'));
      agg.casesWithData += 1;
      agg.totalSessions += data.stats?.sessions || 0;
      agg.totalChatMessages += data.stats?.chatMessages || 0;
      agg.totalRecordings += data.stats?.recordings || 0;
      agg.totalNoteEvents += data.stats?.noteEvents || 0;
      agg.totalStacksPlaced += data.stats?.stacksPlaced || 0;
      if (
        data.stats?.lastPlayedAt &&
        (!agg.lastPlayedAt || data.stats.lastPlayedAt > agg.lastPlayedAt)
      ) {
        agg.lastPlayedAt = data.stats.lastPlayedAt;
      }
    } catch {
      /* skip corrupt file */
    }
  }
  return agg;
}

/** Per-case last activity from on-disk sessions (study / main each have their own user-data). */
export async function listCaseVisitSummaries({ limit = 60 } = {}) {
  ensureUserDirs();
  let files = [];
  try {
    files = await fsp.readdir(USER_CASES_DIR);
  } catch {
    return [];
  }

  const rows = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const caseId = file.replace(/\.json$/i, '');
    try {
      const data = JSON.parse(
        await fsp.readFile(path.join(USER_CASES_DIR, file), 'utf8'),
      );
      let at = data.stats?.lastPlayedAt || data.updatedAt || null;
      for (const session of data.sessions || []) {
        const sessionAt = session.endedAt || session.startedAt;
        if (sessionAt && (!at || sessionAt > at)) at = sessionAt;
      }
      const tailChat = (data.chatHistory || []).slice(-1)[0];
      if (tailChat?.at && (!at || tailChat.at > at)) at = tailChat.at;

      if (!at) continue;
      rows.push({
        caseId: String(data.caseId ?? caseId),
        at,
        completed: false,
        plays: data.stats?.sessions || 0,
        chatMessages: data.stats?.chatMessages ?? (data.chatHistory?.length || 0),
        source: 'server',
        title: data.title || '',
      });
    } catch {
      /* skip corrupt case file */
    }
  }

  return rows
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}
