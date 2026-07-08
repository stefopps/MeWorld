import { decoyReason } from './decoyOrder.js';
import { neutralStackOrderName } from './stackDecoys.js';

/** Build standard vs your-order rows for Teach Me compare panel. */
export function buildTeachCompareRows({
  interventions = [],
  interventionById = {},
  placementOrder = [],
  placed = {},
  nextExpectedId = null,
  reviewResults = null,
}) {
  const expectedOrder = interventions.map((iv) => iv.id);
  const placedRanks = new Map(placementOrder.map((id, idx) => [id, idx + 1]));

  const rows = expectedOrder.map((id, idx) => {
    const iv = interventionById[id];
    if (!iv) return null;
    const expectedSeq = idx + 1;
    const yourSeq = placedRanks.get(id) ?? null;
    const isPlaced = Boolean(placed[id]);
    let status = 'pending';
    if (isPlaced) {
      if (yourSeq === expectedSeq) status = 'match';
      else if (yourSeq != null) status = 'order-off';
      else status = 'placed';
    } else if (id === nextExpectedId) {
      status = 'next';
    } else if (expectedSeq < (expectedOrder.findIndex((x) => x === nextExpectedId) + 1 || Infinity)) {
      status = 'missed';
    }

    const reviewedOk = reviewResults ? Boolean(reviewResults[id]) : null;

    return {
      id,
      expectedSeq,
      yourSeq,
      label: neutralStackOrderName(iv.label),
      why: iv.why || 'No rationale available yet.',
      guideline: iv.guideline || '',
      status,
      isPlaced,
      reviewedOk,
      teachingChannel: iv.teachingChannel || null,
      iv,
    };
  }).filter(Boolean);

  const expectedSet = new Set(expectedOrder);
  const extras = [];

  placementOrder.forEach((id, idx) => {
    if (expectedSet.has(id)) return;
    const iv = interventionById[id];
    if (!iv) return;
    extras.push({
      id,
      yourSeq: idx + 1,
      label: neutralStackOrderName(iv.label),
      why: iv.why || decoyReason(iv) || 'This order is not part of the standard emergent sequence.',
      guideline: iv.guideline || '',
      status: 'extra',
      iv,
    });
  });

  return { rows, extras };
}

export function teachCompareStatusLabel(status) {
  switch (status) {
    case 'match':
      return 'On sequence';
    case 'order-off':
      return 'Out of order';
    case 'next':
      return 'Do this next';
    case 'missed':
      return 'Missed';
    case 'extra':
      return 'Not in standard set';
    case 'placed':
      return 'Placed';
    default:
      return 'Pending';
  }
}

/** Compact standard-flow snapshot for case chat session context. */
export function buildTeachCompareChatContext({
  interventions = [],
  interventionById = {},
  placementOrder = [],
  placed = {},
  nextExpectedId = null,
  reviewResults = null,
}) {
  const { rows, extras } = buildTeachCompareRows({
    interventions,
    interventionById,
    placementOrder,
    placed,
    nextExpectedId,
    reviewResults,
  });

  const nextRow = rows.find((r) => r.id === nextExpectedId);

  return {
    teachMeActive: true,
    nextStep: nextRow
      ? { standardSeq: nextRow.expectedSeq, label: nextRow.label }
      : null,
    rows: rows.map((r) => ({
      standardSeq: r.expectedSeq,
      label: r.label,
      yourPlacementSeq: r.yourSeq,
      status: r.status,
      statusLabel: teachCompareStatusLabel(r.status),
      ...(r.isPlaced ? { clinicalRationale: r.why } : {}),
      ...(r.guideline ? { guideline: r.guideline } : {}),
      ...(r.status === 'order-off' && r.yourSeq != null
        ? { orderNote: `Standard step #${r.expectedSeq}, you placed it #${r.yourSeq}.` }
        : {}),
      ...(reviewResults && r.isPlaced
        ? { clinicallyAppropriate: Boolean(reviewResults[r.id]) }
        : {}),
    })),
    outsideStandard: extras.map((e) => ({
      yourPlacementSeq: e.yourSeq,
      label: e.label,
      statusLabel: teachCompareStatusLabel(e.status),
    })),
    counts: {
      totalStandard: rows.length,
      placed: rows.filter((r) => r.isPlaced).length,
      onSequence: rows.filter((r) => r.status === 'match').length,
      outOfOrder: rows.filter((r) => r.status === 'order-off').length,
      pending: rows.filter((r) => ['pending', 'next', 'missed'].includes(r.status)).length,
    },
  };
}
