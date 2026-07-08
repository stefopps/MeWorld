import { getCategories } from '../data/useCcsCatalog.js';
import { STORAGE } from './storageKeys.js';

/** Category + case the learner was browsing — restored on exit / case list. */
export function categoryIdForCase(caseId) {
  const id = String(caseId ?? '').trim();
  if (!id) return null;
  const padded = /^\d+$/.test(id) ? id.padStart(3, '0') : id;
  for (const cat of getCategories()) {
    const ids = cat.caseIds || [];
    if (ids.includes(id) || ids.includes(padded)) return cat.id;
  }
  return null;
}

export function readCaseBrowseContext() {
  try {
    const raw = localStorage.getItem(STORAGE.caseBrowseContext);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCaseBrowseContext(partial = {}) {
  const prev = readCaseBrowseContext() || {};
  const next = {
    ...prev,
    ...partial,
    at: Date.now(),
  };
  try {
    localStorage.setItem(STORAGE.caseBrowseContext, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function rememberCaseBrowse(caseId, { categoryId = null, entry = null } = {}) {
  if (caseId == null) return null;
  return writeCaseBrowseContext({
    caseId: String(caseId),
    categoryId: categoryId || categoryIdForCase(caseId) || readCaseBrowseContext()?.categoryId || null,
    entry: entry || readCaseBrowseContext()?.entry || 'briefing',
  });
}

export function initialBrowseCategoryId(fallback = null) {
  const ctx = readCaseBrowseContext();
  if (ctx?.categoryId) return ctx.categoryId;
  return fallback;
}
