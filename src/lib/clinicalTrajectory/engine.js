import { formatBmpLine } from '../labPanelValues.js';
import { formatEcgStageText } from './ecgStages.js';
import { HYPERKALEMIA_SPEC } from './specs/hyperkalemia.js';

const SPECS_BY_CASE = new Map();
for (const spec of [HYPERKALEMIA_SPEC]) {
  for (const cid of spec.caseIds || []) SPECS_BY_CASE.set(String(cid), spec);
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function getTrajectorySpec(caseId) {
  return SPECS_BY_CASE.get(String(caseId ?? '').trim()) || null;
}

export function hasClinicalTrajectory(caseId) {
  return Boolean(getTrajectorySpec(caseId));
}

/** Chronological orders from stack placement + extra lab orders. */
export function buildOrderLog({ placementOrder = [], extraOrders = [], interventionById = {} } = {}) {
  const log = [];
  for (const id of placementOrder) {
    const iv = interventionById[id];
    log.push({
      orderId: id,
      label: iv?.label || id,
    });
  }
  for (const row of extraOrders) {
    log.push({
      orderId: row.id || `extra-${norm(row.name)}`,
      label: row.name || row.label || 'Order',
    });
  }
  return log;
}

function orderMatchesTreatment(entry, treatment) {
  if (!entry) return false;
  if (treatment.orderIds?.includes(entry.orderId)) return true;
  return treatment.labelRe?.test(entry.label || '');
}

function isTreatmentOrder(entry, spec) {
  if (!entry || !spec?.treatments) return false;
  return Object.values(spec.treatments).some((t) => orderMatchesTreatment(entry, t));
}

function applyTreatmentEffect(state, treatment) {
  const eff = treatment.effect || {};
  const next = { ...state };
  if (eff.kDelta) next.k = roundK(next.k + eff.kDelta);
  if (eff.ecgDelta) {
    next.ecgStage = Math.max(0, Math.min(5, next.ecgStage + eff.ecgDelta));
    if (eff.capEcg != null) next.ecgStage = Math.min(next.ecgStage, eff.capEcg);
  }
  return next;
}

function applyDelay(state, spec) {
  const d = spec.delayPerOrder || {};
  return {
    k: roundK(state.k + (d.kDelta || 0)),
    ecgStage: Math.max(0, Math.min(5, state.ecgStage + (d.ecgDelta || 0))),
  };
}

function syncEcgFromK(state, spec) {
  let ecg = state.ecgStage;
  for (const row of spec.kToEcgFloor || []) {
    if (state.k >= row.kMin) ecg = Math.max(ecg, row.ecgMin);
  }
  return { ...state, ecgStage: Math.max(0, Math.min(5, ecg)) };
}

function roundK(v) {
  return Math.round(Number(v) * 10) / 10;
}

function initialState(spec) {
  const b = spec.baseline || {};
  return {
    k: b.k ?? 4.2,
    ecgStage: b.ecgStage ?? 0,
  };
}

/** State after processing orders [0..throughIndex] inclusive. */
export function computeTrajectoryState(spec, orderLog, throughIndex = orderLog.length - 1) {
  if (!spec) return null;
  let state = initialState(spec);
  const end = Math.max(-1, Math.min(throughIndex, orderLog.length - 1));

  for (let i = 0; i <= end; i += 1) {
    const entry = orderLog[i];
    let treated = false;
    for (const treatment of Object.values(spec.treatments || {})) {
      if (orderMatchesTreatment(entry, treatment)) {
        state = applyTreatmentEffect(state, treatment);
        treated = true;
        break;
      }
    }
    if (!treated && spec.delayIfNoTreatment && !isTreatmentOrder(entry, spec)) {
      const isObservational = /ecg|ekg|bmp|lab|monitor|vital/i.test(entry.label || '');
      if (!isObservational || i > 0) {
        state = applyDelay(state, spec);
      }
    }
    state = syncEcgFromK(state, spec);
  }
  return state;
}

/** Index in orderLog for this placed order (supports repeat ECG/BMP extras). */
export function findOrderLogIndex(orderLog, intervention) {
  if (!orderLog?.length || !intervention) return -1;
  const targetOcc = Number.isFinite(intervention.trajectoryOccurrence)
    ? intervention.trajectoryOccurrence
    : 0;
  const lbl = norm(intervention.label);

  if (intervention.id && orderLog.some((e) => e.orderId === intervention.id)) {
    let seen = 0;
    for (let i = 0; i < orderLog.length; i += 1) {
      if (orderLog[i].orderId !== intervention.id) continue;
      if (seen === targetOcc) return i;
      seen += 1;
    }
  }

  let seen = 0;
  for (let i = 0; i < orderLog.length; i += 1) {
    if (norm(orderLog[i].label) !== lbl) continue;
    if (seen === targetOcc) return i;
    seen += 1;
  }
  return orderLog.length - 1;
}

function isRepeatableMeasure(label) {
  const l = norm(label);
  return /ecg|ekg|electrocardiog|bmp|cmp|basic metabolic|potassium|\bk\+/i.test(l);
}

/** Snapshots at each BMP/ECG order for graph mode. */
export function buildMeasureSnapshots(spec, orderLog) {
  if (!spec || !orderLog?.length) return [];
  const snaps = [];
  let measureIdx = 0;

  snaps.push({
    id: 'baseline',
    label: 'Baseline',
    atOrderIndex: -1,
    state: initialState(spec),
    kind: 'baseline',
  });

  for (let i = 0; i < orderLog.length; i += 1) {
    const entry = orderLog[i];
    if (!isRepeatableMeasure(entry.label)) continue;
    measureIdx += 1;
    const state = computeTrajectoryState(spec, orderLog, i);
    const isEcg = /ecg|ekg|electrocardiog/i.test(entry.label || '');
    snaps.push({
      id: `set-${measureIdx}`,
      label: measureIdx === 1 ? 'Set 1' : `Set ${measureIdx}`,
      atOrderIndex: i,
      orderLabel: entry.label,
      state,
      kind: isEcg ? 'ecg' : 'bmp',
    });
  }
  return snaps;
}

export function resolveTrajectoryBmpText(state, ctx, teachMeMode) {
  const k = state?.k ?? 4.2;
  const bmp = {
    glucose: 98,
    na: 136,
    k,
    cl: 102,
    hco3: 22,
    bun: 24,
    cr: 1.3,
  };
  let hint = '';
  if (k >= 6.5) hint = 'Critical hyperkalemia.';
  else if (k >= 5.5) hint = 'Hyperkalemia.';
  else if (k <= 3.5) hint = 'Hypokalemia — reassess repletion.';
  return formatBmpLine(bmp, { teachMeMode, hint });
}

export function resolveTrajectoryEcgText(state, teachMeMode) {
  return formatEcgStageText(state?.ecgStage ?? 0, { teachMeMode, k: state?.k });
}

/**
 * Trajectory-aware result for repeat labs / ECG.
 * @returns {{ kind, kindLabel, text, trajectoryState, snapshotId } | null}
 */
export function resolveTrajectoryOrderResult(
  intervention,
  { caseId, orderLog = [], teachMeMode = false } = {},
) {
  const spec = getTrajectorySpec(caseId);
  if (!spec || !intervention?.label) return null;

  const label = intervention.label;
  const l = norm(label);
  const isBmp = /bmp|cmp|basic metabolic|potassium|\bk\+/i.test(l);
  const isEcg = /ecg|ekg|electrocardiog/i.test(l);
  if (!isBmp && !isEcg) return null;

  const throughIndex = findOrderLogIndex(orderLog, intervention);
  const state = computeTrajectoryState(spec, orderLog, throughIndex);
  if (!state) return null;

  const snapshots = buildMeasureSnapshots(spec, orderLog);
  const snap =
    snapshots.find((s) => s.atOrderIndex === throughIndex) ||
    snapshots[snapshots.length - 1];

  if (isEcg) {
    return {
      kind: 'imaging',
      kindLabel: 'ECG result',
      text: resolveTrajectoryEcgText(state, teachMeMode),
      trajectoryState: state,
      snapshotId: snap?.id,
      snapshots,
    };
  }

  return {
    kind: 'lab',
    kindLabel: 'Lab result',
    text: resolveTrajectoryBmpText(state, {}, teachMeMode),
    trajectoryState: state,
    snapshotId: snap?.id,
    snapshots,
  };
}

/** Series for graph panel — merges BMP K+ and ECG stage on shared timeline. */
export function buildTrendSeries(snapshots = []) {
  const points = snapshots
    .filter((s) => s.state)
    .map((s) => ({
      id: s.id,
      label: s.label,
      k: s.state.k,
      ecgStage: s.state.ecgStage,
      kind: s.kind,
    }));
  return { points, metrics: ['k', 'ecgStage'] };
}
