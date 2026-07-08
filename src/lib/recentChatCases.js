import { STORAGE } from './storageKeys.js';
import { getCaseById } from '../data/useCcsCatalog.js';

function readLocalChatMap() {
  try {
    const raw = localStorage.getItem(STORAGE.caseChatHistory);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Cases with saved chat/notes activity, most recent first. */
export function listCasesWithChatActivity({ limit = 24 } = {}) {
  const map = readLocalChatMap();
  const rows = Object.entries(map)
    .map(([caseId, messages]) => {
      const list = Array.isArray(messages) ? messages : [];
      const last = list[list.length - 1];
      return {
        caseId: String(caseId),
        messageCount: list.length,
        lastAt: last?.at || null,
      };
    })
    .filter((row) => row.messageCount > 0)
    .sort((a, b) => {
      const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
      const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
      return tb - ta;
    })
    .slice(0, limit);

  return rows.map((row) => {
    const gameCase = getCaseById(row.caseId);
    return {
      ...row,
      ccsNumber: gameCase?.ccsNumber ?? row.caseId,
      title: gameCase?.title || `Case ${row.caseId}`,
    };
  });
}

export function caseHasChatActivity(caseId) {
  if (caseId == null) return false;
  const list = readLocalChatMap()[String(caseId)];
  return Array.isArray(list) && list.length > 0;
}

export const PLAY_OPEN_TAB_KEY = 'schoonmaker_play_open_tab';

export function stashPlayOpenTab(tab) {
  try {
    sessionStorage.setItem(PLAY_OPEN_TAB_KEY, tab);
  } catch {
    /* ignore */
  }
}

export function consumePlayOpenTab() {
  try {
    const tab = sessionStorage.getItem(PLAY_OPEN_TAB_KEY);
    sessionStorage.removeItem(PLAY_OPEN_TAB_KEY);
    return tab;
  } catch {
    return null;
  }
}
