import { getRecentCaseHistory as getProgressHistory, normalizeCaseProgressId } from '../data/caseProgress.js';
import { getCaseById } from '../data/useCcsCatalog.js';
import { listCasesWithChatActivity } from './recentChatCases.js';
import { countCasesCovered } from './caseCoverage.js';

export { countCasesCovered };

function mergeAt(existing, candidate) {
  if (!candidate) return existing;
  if (!existing) return candidate;
  return new Date(candidate).getTime() > new Date(existing).getTime() ? candidate : existing;
}

/** Progress visits + chat-only cases + optional server sessions, enriched with catalog titles. */
export function getCaseVisitHistory({ limit = 30, serverRows = null } = {}) {
  const byId = new Map();

  for (const row of getProgressHistory({ limit: limit * 2 })) {
    byId.set(row.caseId, { ...row });
  }

  for (const row of listCasesWithChatActivity({ limit: limit * 2 })) {
    const id = normalizeCaseProgressId(row.caseId);
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, {
        caseId: id,
        at: row.lastAt,
        completed: false,
        plays: 0,
        chatMessages: row.messageCount,
        source: 'chat',
      });
      continue;
    }
    byId.set(id, {
      ...prev,
      at: mergeAt(prev.at, row.lastAt),
      chatMessages: Math.max(prev.chatMessages || 0, row.messageCount || 0),
    });
  }

  if (Array.isArray(serverRows)) {
    for (const row of serverRows) {
      const id = normalizeCaseProgressId(row.caseId);
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, {
          caseId: id,
          at: row.at,
          completed: Boolean(row.completed),
          plays: row.plays || 0,
          chatMessages: row.chatMessages || 0,
          source: row.source || 'server',
          title: row.title || '',
        });
        continue;
      }
      byId.set(id, {
        ...prev,
        at: mergeAt(prev.at, row.at),
        plays: Math.max(prev.plays || 0, row.plays || 0),
        chatMessages: Math.max(prev.chatMessages || 0, row.chatMessages || 0),
        completed: prev.completed || row.completed,
      });
    }
  }

  return [...byId.values()]
    .filter((row) => row.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit)
    .map((row) => {
      const gameCase = getCaseById(row.caseId);
      return {
        ...row,
        ccsNumber: gameCase?.ccsNumber ?? row.caseId,
        title: gameCase?.title || `Case ${row.caseId}`,
        category: gameCase?.category || '',
      };
    });
}

export function formatCaseVisitWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

/** Human-relative label — "2 days ago", "just now". */
export function formatCaseVisitRelative(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    const days = Math.floor(diff / 86_400_000);
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}
