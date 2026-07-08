import { STORAGE } from './storageKeys.js';
import { appendCaseNotesBlock } from './caseNotes.js';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE.caseYoutubeTranscripts);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE.caseYoutubeTranscripts, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** Saved YouTube captions per case — feeds chat context and case thread. */
export function listCaseYoutubeTranscripts(caseId) {
  const id = String(caseId || '');
  if (!id) return [];
  const row = readAll()[id];
  if (!Array.isArray(row?.videos)) return [];
  return [...row.videos].sort((a, b) =>
    String(a.savedAt || '').localeCompare(String(b.savedAt || '')),
  );
}

export function saveCaseYoutubeTranscript(caseId, { youtubeId, title = '', text = '', cues = [] } = {}) {
  const caseKey = String(caseId || '');
  const videoId = String(youtubeId || '').trim();
  const body = String(text || '').trim();
  if (!caseKey || !videoId || !body) return null;

  const all = readAll();
  const prev = all[caseKey] || { videos: [] };
  const videos = Array.isArray(prev.videos) ? [...prev.videos] : [];
  const idx = videos.findIndex((v) => String(v.youtubeId) === videoId);
  const savedAt = new Date().toISOString();
  const entry = {
    youtubeId: videoId,
    title: String(title || 'YouTube').trim(),
    text: body,
    cues: Array.isArray(cues) ? cues.slice(0, 200) : [],
    savedAt,
  };
  if (idx >= 0) videos[idx] = { ...videos[idx], ...entry };
  else videos.push(entry);
  all[caseKey] = { videos, updatedAt: savedAt };
  writeAll(all);

  const preview = body.length > 900 ? `${body.slice(0, 900)}…` : body;
  appendCaseNotesBlock(caseKey, preview, {
    header: `YouTube transcript · ${entry.title}`,
  });

  return entry;
}
