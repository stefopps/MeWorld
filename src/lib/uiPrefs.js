import { STORAGE } from './storageKeys.js';
import { getPreparedCase } from './caseNarrative.js';

export function defaultUiPrefs() {
  return {
    timedMode: 'timed',
    simulationCreativity: 55,
    /** Order dock — Case chat thread open (study-style tutor history visible after refresh). */
    dockChatExpanded: true,
  };
}

export function readUiPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE.uiPrefs);
    if (!raw) return defaultUiPrefs();
    const parsed = JSON.parse(raw);
    return {
      ...defaultUiPrefs(),
      ...parsed,
      timedMode: parsed?.timedMode === 'untimed' ? 'untimed' : 'timed',
      simulationCreativity:
        Number.isFinite(Number(parsed?.simulationCreativity))
          ? Math.max(0, Math.min(100, Math.round(Number(parsed.simulationCreativity))))
          : 55,
      dockChatExpanded: parsed?.dockChatExpanded !== false,
    };
  } catch {
    return defaultUiPrefs();
  }
}

export function writeUiPrefs(prefs) {
  try {
    localStorage.setItem(STORAGE.uiPrefs, JSON.stringify({ ...readUiPrefs(), ...prefs }));
  } catch {
    /* ignore */
  }
}

export function isTimedMode(prefs = readUiPrefs()) {
  return prefs.timedMode !== 'untimed';
}

const PLACEHOLDER_ORDER = /^order\d+$/i;

export function isPlaceholderOrder(label) {
  return PLACEHOLDER_ORDER.test(String(label || '').trim());
}

function orderInterventions(caseData, filtered) {
  const prepared = getPreparedCase(caseData?.id);
  const teachSteps = caseData?.teachMeSteps || prepared?.teachMeSteps;
  const orderIds =
    (Array.isArray(teachSteps) && teachSteps.length ? teachSteps : null) ||
    (Array.isArray(caseData?.interventionIds) && caseData.interventionIds.length
      ? caseData.interventionIds
      : null) ||
    (Array.isArray(prepared?.interventionIds) && prepared.interventionIds.length
      ? prepared.interventionIds
      : null) ||
    caseData?.algorithm?.steps?.map((s) => s.interventionId).filter(Boolean);

  if (!Array.isArray(orderIds) || orderIds.length === 0) return filtered;

  const byId = Object.fromEntries(filtered.map((iv) => [iv.id, iv]));
  const seen = new Set();
  const ordered = [];
  for (const id of orderIds) {
    if (byId[id] && !seen.has(id)) {
      ordered.push(byId[id]);
      seen.add(id);
    }
  }
  for (const iv of filtered) {
    if (!seen.has(iv.id)) ordered.push(iv);
  }
  return ordered;
}

export function getCaseInterventions(caseData) {
  const list = Array.isArray(caseData?.interventions) ? caseData.interventions : [];
  const filtered = list.filter((iv) => !isPlaceholderOrder(iv?.label));
  return orderInterventions(caseData, filtered);
}

export function getCaseOrderTotal(caseData) {
  return getCaseInterventions(caseData).length;
}
