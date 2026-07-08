import { STORAGE } from './storageKeys.js';

/** Bump with server ORDER_WHY_PROMPT_VERSION when voice rules change. */
const LOCAL_VOICE_VERSION = 6;

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE.orderWhyCache);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE.orderWhyCache, JSON.stringify(map));
  } catch {
    /* storage full */
  }
}

function caseKey(caseId) {
  return String(caseId ?? '').trim().padStart(3, '0');
}

function primaryKey(orderId, depthIdx) {
  return `${String(orderId ?? '').trim()}__d${Math.max(0, Math.min(3, Number(depthIdx) || 0))}`;
}

function peerKey(orderId, depthIdx) {
  return `${String(orderId ?? '').trim()}__peer__d${Math.max(0, Math.min(3, Number(depthIdx) || 0))}`;
}

export function readLocalOrderWhy(caseId, orderId, depthIdx = 3) {
  const ck = caseKey(caseId);
  const pk = primaryKey(orderId, depthIdx);
  if (!ck || !pk) return null;
  const row = readMap()?.[ck]?.[pk];
  if (row?.why && row.promptVersion === LOCAL_VOICE_VERSION) return String(row.why);
  return null;
}

export function writeLocalOrderWhy(caseId, orderId, depthIdx, why, orderLabel = '') {
  const ck = caseKey(caseId);
  const pk = primaryKey(orderId, depthIdx);
  const text = String(why || '').trim();
  if (!ck || !pk || !text) return;
  const map = readMap();
  if (!map[ck]) map[ck] = {};
  map[ck][pk] = {
    why: text,
    orderLabel: String(orderLabel || '').trim() || map[ck][pk]?.orderLabel || '',
    cachedAt: new Date().toISOString(),
    promptVersion: LOCAL_VOICE_VERSION,
    firstOpinionDepth: Math.max(0, Math.min(3, Number(depthIdx) || 0)),
  };
  writeMap(map);
}

export function readLocalPeerOrderWhy(caseId, orderId, depthIdx = 0) {
  const ck = caseKey(caseId);
  const pk = peerKey(orderId, depthIdx);
  if (!ck || !pk) return null;
  const row = readMap()?.[ck]?.[pk];
  if (row?.why && row.promptVersion === LOCAL_VOICE_VERSION) return String(row.why);
  return null;
}

export function clearLocalOrderWhy(
  caseId,
  orderId,
  { peerReview = false, secondOpinionDepth = 0, firstOpinionDepth = 3 } = {},
) {
  const ck = caseKey(caseId);
  const ok = peerReview
    ? peerKey(orderId, secondOpinionDepth)
    : primaryKey(orderId, firstOpinionDepth);
  if (!ck || !ok) return;
  const map = readMap();
  if (!map[ck]?.[ok]) return;
  delete map[ck][ok];
  if (!Object.keys(map[ck]).length) delete map[ck];
  writeMap(map);
}

export function writeLocalPeerOrderWhy(caseId, orderId, depthIdx, why, orderLabel = '') {
  const ck = caseKey(caseId);
  const pk = peerKey(orderId, depthIdx);
  const text = String(why || '').trim();
  if (!ck || !pk || !text) return;
  const map = readMap();
  if (!map[ck]) map[ck] = {};
  map[ck][pk] = {
    why: text,
    orderLabel: String(orderLabel || '').trim() || map[ck][pk]?.orderLabel || '',
    cachedAt: new Date().toISOString(),
    promptVersion: LOCAL_VOICE_VERSION,
    peerReview: true,
    secondOpinionDepth: Math.max(0, Math.min(3, Number(depthIdx) || 0)),
  };
  writeMap(map);
}
