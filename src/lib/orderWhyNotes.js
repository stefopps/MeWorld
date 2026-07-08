import { appendCaseNotesBlock, readCaseNotes } from './caseNotes.js';
import { resolveFirstOpinionDepthConfig } from './firstOpinionPrefs.js';
import { resolveSecondOpinionDepthConfig, LOCKED_SECOND_OPINION_DEPTH } from './secondOpinionPrefs.js';

function dedupMarker({ orderId, peerReview, depthIdx, firstDepthIdx }) {
  const oid = String(orderId || '').trim();
  if (!oid) return '';
  return peerReview
    ? `order-why:peer:${oid}:d${depthIdx}`
    : `order-why:first:${oid}:d${firstDepthIdx}`;
}

/** Persist first / second opinion text into the per-case notes journal (cases/notes/NNN.md). */
export function persistOrderWhyToCaseNotes(
  caseId,
  { orderId, orderLabel, why, peerReview = false, secondOpinionDepth = LOCKED_SECOND_OPINION_DEPTH, firstOpinionDepth = 3 } = {},
) {
  const text = String(why || '').trim();
  if (!text || caseId == null || caseId === '') return false;

  const depthIdx = Math.max(0, Math.min(3, Number(secondOpinionDepth) || 0));
  const firstDepthIdx = Math.max(0, Math.min(3, Number(firstOpinionDepth) || 0));
  const marker = dedupMarker({ orderId, peerReview, depthIdx, firstDepthIdx });
  const existing = readCaseNotes(caseId);
  if (marker && existing.includes(marker)) return false;

  const label = String(orderLabel || orderId || 'Order').trim();
  const depthLabel = peerReview
    ? resolveSecondOpinionDepthConfig(LOCKED_SECOND_OPINION_DEPTH).label
    : resolveFirstOpinionDepthConfig(firstDepthIdx).label;
  const header = peerReview
    ? `Teach Me · Second opinion (${depthLabel}) · ${label}`
    : `Teach Me · First opinion (${depthLabel}) · ${label}`;

  const body = marker ? `<!-- ${marker} -->\n\n${text}` : text;
  appendCaseNotesBlock(caseId, body, { header });
  return true;
}
