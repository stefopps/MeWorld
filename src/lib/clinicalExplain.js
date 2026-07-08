import { apiUrl } from './apiBase.js';
import { buildCaseChatContext } from './caseChat.js';
import {
  getBakedDifferentialExplain,
  getBakedOrderWhy,
} from './caseExplainers.js';
import { buildOfflineDifferentialExplain } from './offlineDifferentialExplain.js';

const orderMemory = new Map();

function memKey(caseId, orderId) {
  return `${caseId}::${orderId}`;
}

function caseSummaryExcerpt(ccsReview) {
  if (!ccsReview?.caseSummary) return '';
  let text = String(ccsReview.caseSummary);
  const cutoff = text.search(/\n\s*Average\s+Orders/i);
  if (cutoff >= 0) text = text.slice(0, cutoff);
  return text.trim().slice(0, 1200);
}

/** Instant order rationale — baked DeepSeek per case, else playbook text. */
export function getInstantOrderExplain(caseId, orderId, playbookWhy = '') {
  const baked = caseId ? getBakedOrderWhy(caseId, orderId) : null;
  if (baked?.why) return { why: baked.why, source: 'baked' };
  const fallback = String(playbookWhy || '').trim();
  if (fallback) return { why: fallback, source: 'playbook' };
  return null;
}

/** Instant diagnosis explainer — baked DeepSeek per case, else CCS review parse. */
export function getInstantDiagnosisExplain({
  caseId,
  diagnosis,
  topic,
  caseDiagnosis,
  ccsReview,
}) {
  const baked = caseId ? getBakedDifferentialExplain(caseId, diagnosis) : null;
  if (baked?.hook) return { ...baked, source: 'baked' };
  const offline = buildOfflineDifferentialExplain({
    diagnosis,
    topic,
    caseDiagnosis,
    ccsReview,
  });
  if (offline?.hook) return { ...offline, source: offline.source || 'ccs-review' };
  return null;
}

/**
 * Order explainer — Play Teach Me "Why" + differential high-yield orders.
 * Priority: baked DeepSeek → live DeepSeek API → playbook text.
 */
export async function fetchOrderExplain({
  caseId,
  orderId,
  orderLabel,
  caseData = null,
  playbookWhy = '',
}) {
  const cid = String(caseId ?? '').trim();
  const oid = String(orderId ?? '').trim();
  if (!cid || !oid || !orderLabel) throw new Error('Missing case or order');

  const memHit = orderMemory.get(memKey(cid, oid));
  if (memHit) return { why: memHit, source: 'memory' };

  const instant = getInstantOrderExplain(cid, oid, playbookWhy);
  if (instant?.source === 'baked') {
    orderMemory.set(memKey(cid, oid), instant.why);
    return instant;
  }

  const fallback = String(playbookWhy || '').trim();
  const caseContext = caseData ? buildCaseChatContext(caseData, { chatMode: 'tutor' }) : null;

  try {
    const res = await fetch(apiUrl('/api/order-why'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: cid,
        orderId: oid,
        orderLabel,
        playbookWhy: fallback,
        caseContext,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Order why failed (${res.status})`);
    const why = String(data.why || '').trim();
    if (!why) throw new Error('Empty response');
    orderMemory.set(memKey(cid, oid), why);
    return {
      why,
      source: data.cached ? 'server-cache' : data.provider || 'deepseek',
    };
  } catch (e) {
    if (fallback) {
      orderMemory.set(memKey(cid, oid), fallback);
      return { why: fallback, source: 'playbook' };
    }
    if (instant?.why) return instant;
    throw e;
  }
}

/**
 * Fresh attending angle — bypasses baked/cache; requires the first explanation text.
 */
export async function fetchOrderSecondOpinion({
  caseId,
  orderId,
  orderLabel,
  caseData = null,
  playbookWhy = '',
  previousWhy = '',
}) {
  const cid = String(caseId ?? '').trim();
  const oid = String(orderId ?? '').trim();
  const prior = String(previousWhy ?? '').trim();
  if (!cid || !oid || !orderLabel) throw new Error('Missing case or order');
  if (!prior) throw new Error('Need a first explanation before second opinion');

  const fallback = String(playbookWhy || '').trim();
  const caseContext = caseData ? buildCaseChatContext(caseData, { chatMode: 'tutor' }) : null;

  const res = await fetch(apiUrl('/api/order-why'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId: cid,
      orderId: oid,
      orderLabel,
      playbookWhy: fallback,
      caseContext,
      alternate: true,
      previousWhy: prior,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Second opinion failed (${res.status})`);
  const why = String(data.why || '').trim();
  if (!why) throw new Error('Empty response');
  return {
    why,
    source: 'alternate',
    alternate: true,
  };
}

/**
 * Diagnosis explainer — mobile differential Teach Me + drill panel.
 * Priority: baked DeepSeek → live DeepSeek API → CCS review excerpt.
 */
export async function fetchDiagnosisExplain({
  caseId,
  diagnosis,
  topic,
  caseDiagnosis,
  ccsReview = null,
}) {
  const dx = String(diagnosis || '').trim();
  if (!dx) throw new Error('Missing diagnosis');

  const instant = getInstantDiagnosisExplain({
    caseId,
    diagnosis: dx,
    topic,
    caseDiagnosis,
    ccsReview,
  });
  if (instant?.source === 'baked') return instant;

  const summary = caseSummaryExcerpt(ccsReview);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const r = await fetch(apiUrl('/api/differential/explain'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        caseId: caseId ? Number(caseId) : null,
        diagnosis: dx,
        topic: topic || null,
        caseDiagnosis: caseDiagnosis || null,
        caseSummary: summary || null,
      }),
    });
    clearTimeout(timer);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Explainer failed (${r.status})`);
    if (!data.explain?.hook) throw new Error('Empty explainer');
    return { ...data.explain, source: 'deepseek' };
  } catch (e) {
    clearTimeout(timer);
    if (instant?.hook) return instant;
    throw e;
  }
}

/** @deprecated use fetchOrderExplain */
export const fetchOrderWhy = fetchOrderExplain;

/** @deprecated use fetchDiagnosisExplain */
export const fetchDifferentialExplain = fetchDiagnosisExplain;

/** @deprecated use getInstantDiagnosisExplain */
export const getInstantDifferentialExplain = getInstantDiagnosisExplain;
