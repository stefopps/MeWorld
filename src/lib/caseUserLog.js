import { STORAGE } from './storageKeys.js';
import { apiUrl, getApiBase } from './apiBase.js';

function readLocalChatMap() {
  try {
    const raw = localStorage.getItem(STORAGE.caseChatHistory);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalChatMap(map) {
  try {
    localStorage.setItem(STORAGE.caseChatHistory, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function readLocalChatHistory(caseId) {
  if (caseId == null || caseId === '') return [];
  const rows = readLocalChatMap()[String(caseId)];
  return Array.isArray(rows) ? rows : [];
}

export function writeLocalChatHistory(caseId, messages) {
  if (caseId == null || caseId === '') return;
  const map = readLocalChatMap();
  map[String(caseId)] = messages;
  writeLocalChatMap(map);
}

async function apiJson(path, options = {}) {
  const { timeoutMs = 8000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(apiUrl(path), {
      headers: { 'Content-Type': 'application/json', ...(fetchOptions.headers || {}) },
      ...fetchOptions,
      signal: controller.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOverallUserStats() {
  try {
    const data = await apiJson('/api/user/stats');
    return data.stats || null;
  } catch {
    return null;
  }
}

/** Server-side session + chat timestamps from this tree's user-data (study :3001 vs main :3002). */
export async function fetchCaseVisitSummaries({ limit = 40, timeoutMs = 4000 } = {}) {
  try {
    const data = await apiJson(`/api/user/visits?limit=${encodeURIComponent(limit)}`, { timeoutMs });
    return Array.isArray(data.visits) ? data.visits : [];
  } catch {
    return [];
  }
}

export async function fetchCaseUserData(caseId, { timeoutMs = 2500 } = {}) {
  try {
    return await apiJson(`/api/user/case/${encodeURIComponent(caseId)}`, { timeoutMs });
  } catch {
    return null;
  }
}

export async function fetchPlaySession(caseId, sessionId) {
  if (!caseId || !sessionId) return null;
  try {
    const data = await fetchCaseUserData(caseId);
    const sessions = data?.sessions || [];
    return sessions.find((s) => s.id === sessionId) || null;
  } catch {
    return null;
  }
}

export async function startPlaySession(caseId, meta = {}) {
  const data = await apiJson(`/api/user/case/${encodeURIComponent(caseId)}/session/start`, {
    method: 'POST',
    body: JSON.stringify(meta),
  });
  return data.sessionId || null;
}

export async function endPlaySession(caseId, sessionId, result = {}) {
  if (!caseId || !sessionId) return null;
  try {
    return await apiJson(
      `/api/user/case/${encodeURIComponent(caseId)}/session/${encodeURIComponent(sessionId)}/end`,
      { method: 'POST', body: JSON.stringify({ result }) },
    );
  } catch {
    return null;
  }
}

export async function logPlayEvent(caseId, sessionId, event = {}) {
  if (!caseId || !sessionId) return null;
  try {
    return await apiJson(
      `/api/user/case/${encodeURIComponent(caseId)}/session/${encodeURIComponent(sessionId)}/event`,
      { method: 'POST', body: JSON.stringify({ event }) },
    );
  } catch {
    return null;
  }
}

export async function logChatMessage(caseId, sessionId, role, content) {
  const id = String(caseId || '');
  if (!id || !content) return null;

  const local = readLocalChatHistory(id);
  const row = { role, content, at: new Date().toISOString(), sessionId: sessionId || null };
  writeLocalChatHistory(id, [...local, row]);

  try {
    return await apiJson(`/api/user/case/${encodeURIComponent(id)}/chat`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, role, content }),
    });
  } catch {
    return row;
  }
}

export async function uploadCaseRecording(caseId, sessionId, blob, durationMs) {
  if (!caseId || !sessionId || !blob) return null;
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const audioBase64 = btoa(binary);
  try {
    const data = await apiJson(
      `/api/user/case/${encodeURIComponent(caseId)}/session/${encodeURIComponent(sessionId)}/recording`,
      {
        method: 'POST',
        body: JSON.stringify({
          audioBase64,
          mimeType: blob.type || 'audio/webm',
          durationMs,
        }),
      },
    );
    return data.recording || null;
  } catch (e) {
    throw e instanceof Error ? e : new Error('Could not save recording');
  }
}

export function recordingPublicUrl(relativePath) {
  if (!relativePath) return '';
  const path = relativePath.replace(/^\/+/, '');
  const base = getApiBase();
  return base ? `${base}/user-data/${path}` : `/user-data/${path}`;
}

/** All voice recordings for a case — flat list, oldest first. */
export function listCaseRecordingsFromUserData(data) {
  if (!data) return [];
  let rows = [];
  if (Array.isArray(data.recordings) && data.recordings.length) {
    rows = data.recordings.map((rec) => ({ ...rec }));
  } else if (Array.isArray(data.sessions)) {
    data.sessions.forEach((session) => {
      (session.recordings || []).forEach((rec) => {
        rows.push({ ...rec, attempt: session.attempt, sessionId: session.id });
      });
    });
  }
  rows.sort(
    (a, b) =>
      String(a.at || '').localeCompare(String(b.at || '')) || (a.slot || 0) - (b.slot || 0),
  );
  return rows;
}

function mergeChatRows(...lists) {
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      if (!row?.content) continue;
      const key = `${row.role}:${row.at || ''}:${row.content}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  out.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return ta - tb;
  });
  return out;
}

export async function loadPersistedChatHistory(caseId) {
  const id = String(caseId || '');
  if (!id) return [];
  const local = readLocalChatHistory(id);
  let remote = [];
  try {
    const data = await fetchCaseUserData(caseId);
    remote = (data?.chatHistory || []).map((m) => ({
      role: m.role,
      content: m.content,
      at: m.at,
      sessionId: m.sessionId,
    }));
  } catch {
    remote = [];
  }
  const merged = mergeChatRows(local, remote);
  if (merged.length) {
    const map = readLocalChatMap();
    map[id] = merged;
    writeLocalChatMap(map);
  }
  return merged;
}
