import { apiUrl } from './apiBase.js';
import { buildCaseChatContext } from './caseChat.js';
import { fetchCleanCaseClinical, mergeCleanCaseIntoCtx } from './cleanCaseClinical.js';
import { classifyOrderKind, resolveOrderResult } from './orderResult.js';
import { isRepeatableLabLabel } from './labResultMetrics.js';

const memory = new Map();

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function memKey(caseId, orderId, teachMeMode, occurrence = 0) {
  return `${caseId}::${orderId}::${occurrence}::${teachMeMode ? 'teach' : 'practice'}`;
}

function storageKey(orderId, occurrence = 0) {
  const occ = Number.isFinite(Number(occurrence)) ? Number(occurrence) : 0;
  return occ > 0 ? `${orderId}::${occ}` : String(orderId);
}

/** Walk order log; collect prior lab results from this session memory. */
export function collectPriorLabResults(orderLog, intervention, teachMeMode, caseId) {
  if (!orderLog?.length || !intervention) return [];
  const targetId = intervention.id;
  const targetLabel = norm(intervention.label);
  const targetOcc = Number.isFinite(intervention.trajectoryOccurrence)
    ? intervention.trajectoryOccurrence
    : 0;

  const prior = [];
  const labelOcc = new Map();

  for (const entry of orderLog) {
    const lbl = norm(entry.label);
    const occ = labelOcc.get(lbl) || 0;
    labelOcc.set(lbl, occ + 1);

    const isTarget =
      (targetId && entry.orderId === targetId && occ === targetOcc) ||
      (!targetId && lbl === targetLabel && occ === targetOcc);
    if (isTarget) break;

    if (!isRepeatableLabLabel(entry.label)) continue;
    const mk = memKey(caseId, entry.orderId, teachMeMode, occ);
    const row = memory.get(mk);
    if (row?.text) {
      prior.push({ order: entry.label, occurrence: occ, result: row.text });
    }
  }
  return prior;
}

function buildFallback(intervention, { caseData, caseFlow, teachMeMode, cleanCase = null, orderLog = null }) {
  const trajectoryHit = resolveOrderResult(intervention, {
    caseData,
    caseFlow,
    teachMeMode,
    cleanCase,
    orderLog,
  });
  if (trajectoryHit?.trajectoryState) return trajectoryHit;

  const meta = classifyOrderKind(intervention?.label || '');
  const liveLab = meta.kind === 'lab' || isRepeatableLabLabel(intervention?.label);

  if (liveLab) {
    return {
      kind: meta.kind,
      kindLabel: meta.kindLabel || 'Lab result',
      text: 'Laboratory — awaiting attendant result…',
      pending: true,
    };
  }

  return (
    resolveOrderResult(intervention, {
      caseData,
      caseFlow,
      teachMeMode,
      cleanCase,
      orderLog,
      liveAttendantLabs: true,
    }) || {
      kind: 'order',
      kindLabel: 'Result',
      text: `${intervention?.label || 'Order'} — completed.`,
    }
  );
}

function buildHintText(intervention, ctx) {
  const hint = resolveOrderResult(intervention, { ...ctx, liveAttendantLabs: false });
  return hint?.text || '';
}

/** Server-cached case-aware result (attendant LLM) with session occurrence keys. */
export async function fetchOrderResult({
  caseId,
  orderId,
  orderLabel,
  intervention = null,
  caseData = null,
  caseFlow = null,
  teachMeMode = false,
  playbookWhy = '',
  refresh = false,
  orderLog = [],
  trajectoryOccurrence = 0,
}) {
  const cid = String(caseId ?? caseData?.id ?? '').trim();
  const oid = String(orderId ?? intervention?.id ?? '').trim();
  const label = String(orderLabel ?? intervention?.label ?? '').trim();
  const occ = Number.isFinite(intervention?.trajectoryOccurrence)
    ? intervention.trajectoryOccurrence
    : Number(trajectoryOccurrence) || 0;
  const iv = intervention || { id: oid, label, why: playbookWhy, trajectoryOccurrence: occ };

  const cleanCase = await fetchCleanCaseClinical(cid);
  const fallback = buildFallback(iv, { caseData, caseFlow, teachMeMode, cleanCase, orderLog });

  if (!cid || !oid || !label) {
    return { ...fallback, cached: false, source: 'fallback' };
  }

  const mk = memKey(cid, oid, teachMeMode, occ);
  if (!refresh && memory.has(mk)) {
    return { ...memory.get(mk), cached: true, source: 'memory' };
  }

  const priorLabResults = collectPriorLabResults(orderLog, iv, teachMeMode, cid);
  const hintText = buildHintText(iv, { caseData, caseFlow, teachMeMode, cleanCase, orderLog });

  try {
    const baseContext = caseData
      ? {
          ...buildCaseChatContext(caseData, { chatMode: 'tutor' }),
          exam: caseFlow?.exam || caseData?.physical_exam,
          vitals: caseFlow?.vitals || caseData?.preparedVitals || caseData?.vitals,
        }
      : {};
    const caseContext = mergeCleanCaseIntoCtx(baseContext, cleanCase, label);

    const res = await fetch(apiUrl('/api/order-result'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: cid,
        orderId: oid,
        orderLabel: label,
        playbookWhy: playbookWhy || intervention?.why || '',
        caseContext,
        teachMeMode,
        refresh,
        fallbackText: hintText || fallback.text,
        orderKindHint: fallback.kind,
        trajectoryOccurrence: occ,
        orderLog,
        priorLabResults,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Order result failed (${res.status})`);

    const out = {
      kind: data.kind || fallback.kind,
      kindLabel: data.kindLabel || fallback.kindLabel,
      text: String(data.text || hintText || fallback.text).trim(),
      cached: Boolean(data.cached),
      source: data.provider || (data.cached ? 'server-cache' : 'llm'),
      storageKey: storageKey(oid, occ),
    };
    memory.set(mk, out);
    return out;
  } catch {
    const offline = resolveOrderResult(iv, {
      caseData,
      caseFlow,
      teachMeMode,
      cleanCase,
      orderLog,
      liveAttendantLabs: false,
    });
    return {
      ...(offline || fallback),
      cached: false,
      source: 'fallback',
      storageKey: storageKey(oid, occ),
    };
  }
}

export function getOrderResultMemorySnapshot() {
  const byKey = {};
  for (const [mk, row] of memory.entries()) {
    const parts = mk.split('::');
    const orderId = parts[1];
    const occ = Number(parts[2]) || 0;
    byKey[storageKey(orderId, occ)] = row;
  }
  return byKey;
}

export function prefetchOrderResult(params) {
  void fetchOrderResult(params);
}

export function clearOrderResultMemory() {
  memory.clear();
}
