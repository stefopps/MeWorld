import { buildChatSessionContext } from './buildChatSessionContext.js';
import { buildPlacedResultRows } from './placedResultRows.js';
import { resolveOrderResult } from './orderResult.js';

/** Snapshot of play session for portrait regen — notes, exams, orders, chat. */
export function buildPortraitSessionContext({
  careUnit = '',
  orderTimelineEvents = [],
  conversationLog = [],
  placed = {},
  interventions = [],
  caseId = null,
  teachMeMode = false,
  placementOrder = [],
  interventionById = {},
  nextExpectedId = null,
  reviewResults = null,
  sessionStartedAt = null,
  pins = [],
  caseData = null,
  chatMessages = [],
  liveOrderResults = null,
  caseFlow = null,
}) {
  const base = buildChatSessionContext({
    careUnit,
    orderTimelineEvents,
    conversationLog,
    placed,
    interventions,
    caseId,
    teachMeMode,
    placementOrder,
    interventionById,
    nextExpectedId,
    reviewResults,
    sessionStartedAt,
  });

  const orderResults = [];
  const seenKeys = new Set();
  const rows = buildPlacedResultRows({ interventions, placed, pins, interventionById });
  for (const { iv } of rows) {
    const occ = Number.isFinite(iv.trajectoryOccurrence) ? iv.trajectoryOccurrence : 0;
    const storageKey = occ > 0 ? `${iv.id}::${occ}` : String(iv.id);
    const live = liveOrderResults?.[storageKey];
    const result =
      live?.text?.trim()
        ? {
            kind: live.kind || 'order',
            kindLabel: live.kindLabel || 'Result',
            text: live.text,
          }
        : resolveOrderResult(iv, { caseData, caseFlow, teachMeMode });
    if (!result?.text || result.pending) continue;
    seenKeys.add(storageKey);
    orderResults.push({
      orderId: iv.id,
      label: iv.label,
      kind: result.kind,
      kindLabel: result.kindLabel,
      text: result.text,
    });
  }

  // Catch live results whose order isn't a placed pin (typed/dock orders, rechecks).
  // Without this, a lab the learner ordered from the dock has a value on screen but
  // never reaches the attending ledger — the tutor "can't see the labs".
  for (const [storageKey, live] of Object.entries(liveOrderResults || {})) {
    if (seenKeys.has(storageKey) || !live?.text?.trim()) continue;
    const orderId = String(storageKey).split('::')[0];
    const iv = interventionById?.[orderId] || null;
    orderResults.push({
      orderId,
      label: live.label || iv?.label || live.kindLabel || 'Order',
      kind: live.kind || 'order',
      kindLabel: live.kindLabel || 'Result',
      text: live.text,
    });
  }

  const physicalExamFindings = orderResults.filter((r) => r.kind === 'exam');
  const labResults = orderResults.filter((r) => r.kind === 'lab');
  const imagingResults = orderResults.filter((r) => r.kind === 'imaging');
  const procedureResults = orderResults.filter(
    (r) => r.kind === 'procedure' || r.kind === 'counseling',
  );
  const chatSnippet = (Array.isArray(chatMessages) ? chatMessages : [])
    .filter((m) => m?.content && (m.role === 'user' || m.role === 'assistant' || m.role === 'patient'))
    .slice(-20)
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 400),
    }));

  const hasSessionData = Boolean(
    base.learnerNotes
    || (base.ordersTimeline && base.ordersTimeline.length > 0)
    || orderResults.length > 0
    || chatSnippet.length > 0
    || (base.stacksPlaced && base.stacksPlaced.length > 0),
  );

  const tutorSessionHint =
    orderResults.length > 0
      ? 'orderResults lists every stack and extra order placed this run with attendant result text (labs, imaging, exams). Coach from these values — do not invent results for orders not in orderResults.'
      : null;

  return {
    ...base,
    orderResults,
    physicalExamFindings,
    labResults,
    imagingResults,
    procedureResults,
    chatMessages: chatSnippet,
    hasSessionData,
    tutorSessionHint,
  };
}
