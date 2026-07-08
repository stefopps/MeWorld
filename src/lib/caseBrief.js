import { STORAGE } from './storageKeys.js';
import { apiUrl } from './apiBase.js';

function readBriefMap() {
  try {
    const raw = localStorage.getItem(STORAGE.caseBriefMarkdown);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeBriefMap(map) {
  try {
    localStorage.setItem(STORAGE.caseBriefMarkdown, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function readLocalCaseBrief(caseId) {
  const row = readBriefMap()[String(caseId)];
  return row?.markdown || null;
}

export function writeLocalCaseBrief(caseId, payload) {
  if (!caseId || !payload?.markdown) return;
  const map = readBriefMap();
  map[String(caseId)] = {
    markdown: payload.markdown,
    url: payload.url || null,
    sourceHash: payload.sourceHash || null,
    cachedAt: payload.cachedAt || new Date().toISOString(),
  };
  writeBriefMap(map);
}

export function clearLocalCaseBrief(caseId) {
  const map = readBriefMap();
  delete map[String(caseId)];
  writeBriefMap(map);
}

/** LLM-reorganized Markdown dossier for one case (OCR + JSON + transcripts + raw data). */
export async function resolveCaseBriefMarkdown(
  caseId,
  { caseDiscussion = null, caseContext = null, refresh = false } = {},
) {
  if (!caseId) return null;

  if (refresh) clearLocalCaseBrief(caseId);

  try {
    const r = await fetch(apiUrl(`/api/case-brief/${encodeURIComponent(caseId)}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh, clientDiscussion, caseContext }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Case brief build failed');
    if (data.markdown) {
      writeLocalCaseBrief(caseId, data);
      return data.markdown;
    }
  } catch {
    if (!refresh) return readLocalCaseBrief(caseId);
  }

  return null;
}

export function briefCacheKey(markdown) {
  if (!markdown) return '';
  return `${markdown.length}:${markdown.slice(0, 80)}`;
}
