import { STORAGE } from './storageKeys.js';
import { readUiPrefs, writeUiPrefs } from './uiPrefs.js';

export const SIMULATION_CREATIVITY_CHANGED = 'schoonmaker-simulation-creativity-changed';

export const DEFAULT_SIMULATION_CREATIVITY = 55;

export function creativityBand(score) {
  const c = Math.max(0, Math.min(100, Number(score) || 0));
  if (c < 30) return { band: 'strict', label: 'Strict' };
  if (c < 65) return { band: 'balanced', label: 'Balanced' };
  return { band: 'immersive', label: 'Immersive' };
}

function notifyCreativityChange(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SIMULATION_CREATIVITY_CHANGED, { detail }));
}

export function readCaseSimulationCreativity(caseId) {
  if (caseId == null) return null;
  try {
    const raw = localStorage.getItem(STORAGE.caseSimulationCreativity);
    if (!raw) return null;
    const map = JSON.parse(raw);
    const v = map?.[String(caseId)];
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
  } catch {
    return null;
  }
}

export function writeCaseSimulationCreativity(caseId, value) {
  if (caseId == null) return;
  try {
    const raw = localStorage.getItem(STORAGE.caseSimulationCreativity);
    const map = raw ? JSON.parse(raw) : {};
    const id = String(caseId);
    if (value == null) {
      delete map[id];
    } else {
      map[id] = Math.max(0, Math.min(100, Math.round(Number(value))));
    }
    localStorage.setItem(STORAGE.caseSimulationCreativity, JSON.stringify(map));
    notifyCreativityChange({ scope: 'case', caseId: id, value: map[id] ?? null });
  } catch {
    /* ignore */
  }
}

export function readGlobalSimulationCreativity() {
  const prefs = readUiPrefs();
  const n = Number(prefs.simulationCreativity);
  if (!Number.isFinite(n)) return DEFAULT_SIMULATION_CREATIVITY;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function writeGlobalSimulationCreativity(value) {
  const n = Math.max(0, Math.min(100, Math.round(Number(value))));
  writeUiPrefs({ simulationCreativity: n });
  notifyCreativityChange({ scope: 'global', value: n });
}

/** Per-case override when set; otherwise global default. */
export function resolveSimulationCreativity(caseId) {
  const perCase = readCaseSimulationCreativity(caseId);
  if (perCase != null) return perCase;
  return readGlobalSimulationCreativity();
}

export function caseUsesGlobalCreativity(caseId) {
  return readCaseSimulationCreativity(caseId) == null;
}
