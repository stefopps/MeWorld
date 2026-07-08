import { buildCaseChatContext, writeCasePortraitPersona } from './caseChat.js';
import { getCaseById } from '../data/useCcsCatalog.js';
import {
  writeCaseRegenImage,
  fetchCasePortraitStatus,
  clearCaseRegenImage,
} from './patientRegen.js';
import { STORAGE } from './storageKeys.js';
import { apiUrl } from './apiBase.js';

export const CASE_AVATAR_EVENT = 'schoonmaker-case-avatar';

function readAvatarSourcesDict() {
  try {
    const raw = localStorage.getItem(STORAGE.caseAvatarSources);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAvatarSourcesDict(dict) {
  try {
    localStorage.setItem(STORAGE.caseAvatarSources, JSON.stringify(dict));
  } catch {
    /* ignore */
  }
}

/** Real World pick for this case — local only, no OpenAI. */
export function readStoredCaseAvatarSource(caseId) {
  if (!caseId) return null;
  const entry = readAvatarSourcesDict()[String(caseId)];
  if (!entry?.youtubeId) return null;
  return entry;
}

function normAvatarLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** One avatar per case — match stored pick to a story/video row (not youtubeId alone). */
export function avatarPickMatches(stored, pick) {
  if (!stored?.youtubeId || !pick?.youtubeId) return false;
  if (String(stored.youtubeId) !== String(pick.youtubeId)) return false;

  const storedName = normAvatarLabel(stored.patientName);
  const pickName = normAvatarLabel(pick.patientName);
  if (storedName && pickName) return storedName === pickName;

  if (stored.storyId && pick.storyId) return String(stored.storyId) === String(pick.storyId);

  return !storedName && !pickName;
}

export async function readCaseAvatarSource(caseId) {
  const local = readStoredCaseAvatarSource(caseId);
  if (local) return local;
  const status = await fetchCasePortraitStatus(caseId);
  return status.sourceVideo || null;
}

export function buildAvatarCaseContext(caseId) {
  const caseData = getCaseById(caseId);
  if (!caseData) return { id: caseId };
  return buildCaseChatContext(caseData);
}

/** Note Real World patient as case avatar — stored in localStorage; portrait generated later in Briefing/Play. */
export function setCaseAvatarFromVideo({
  caseId,
  youtubeId,
  title = '',
  patientName = '',
  storyId = null,
}) {
  const id = String(youtubeId || '').trim();
  if (!caseId || !id) throw new Error('Missing case or video id');

  const prev = readStoredCaseAvatarSource(caseId);
  if (
    prev?.youtubeId !== id ||
    normAvatarLabel(prev?.patientName) !== normAvatarLabel(patientName)
  ) {
    clearCaseRegenImage(caseId);
  }

  const sourceVideo = {
    youtubeId: id,
    title: String(title || '').trim() || null,
    patientName: String(patientName || '').trim() || null,
    storyId: storyId || null,
    selectedAt: new Date().toISOString(),
  };

  const dict = readAvatarSourcesDict();
  dict[String(caseId)] = sourceVideo;
  writeAvatarSourcesDict(dict);

  try {
    window.dispatchEvent(
      new CustomEvent(CASE_AVATAR_EVENT, {
        detail: { caseId: String(caseId), sourceVideo, storedOnly: true },
      }),
    );
  } catch {
    /* ignore */
  }

  return { ok: true, caseId, sourceVideo };
}

/** Generate portrait from a stored Real World pick (Briefing / Play). */
export async function generateCasePortraitFromAvatarSource(caseData, { refresh = false } = {}) {
  const caseId = caseData?.id;
  const source = readStoredCaseAvatarSource(caseId);
  if (!source?.youtubeId) return null;

  if (!refresh) {
    const status = await fetchCasePortraitStatus(caseId);
    if (status.exists && status.url) {
      writeCaseRegenImage(caseId, status.url);
      if (status.persona) writeCasePortraitPersona(caseId, status.persona);
      return status.url;
    }
  }

  const ctx = buildAvatarCaseContext(caseId);
  const r = await fetch(apiUrl('/api/case-avatar/from-video'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId,
      youtubeId: source.youtubeId,
      title: source.title || '',
      patientName: source.patientName || '',
      storyId: source.storyId || null,
      caseContext: ctx,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Could not generate case avatar');

  const url = data.dataUrl || data.url;
  if (url) writeCaseRegenImage(caseId, url);
  if (data.persona) writeCasePortraitPersona(caseId, data.persona);

  try {
    window.dispatchEvent(
      new CustomEvent(CASE_AVATAR_EVENT, {
        detail: { caseId: String(caseId), url, sourceVideo: data.sourceVideo || source },
      }),
    );
  } catch {
    /* ignore */
  }

  return url || null;
}
