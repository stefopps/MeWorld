import { parseBmpMetrics, isRepeatableLabLabel } from './labResultMetrics.js';

/**
 * Build trend points from session order log + live attendant result texts.
 * Merges with trajectory snapshots when present.
 */
export function buildLiveLabTrendPoints(orderLog = [], resultByKey = {}, trajectoryPoints = []) {
  if (trajectoryPoints?.length >= 2) {
    return trajectoryPoints;
  }

  const points = [];
  const labelOcc = new Map();
  let setIdx = 0;

  for (const entry of orderLog || []) {
    if (!isRepeatableLabLabel(entry.label)) continue;
    const lbl = String(entry.label).toLowerCase();
    const occ = labelOcc.get(lbl) || 0;
    labelOcc.set(lbl, occ + 1);
    const cacheKey = `${entry.orderId}::${occ}`;
    const text = resultByKey[cacheKey]?.text || resultByKey[entry.orderId]?.text;
    if (!text) continue;

    const metrics = parseBmpMetrics(text);
    if (metrics.k == null && metrics.cr == null) continue;

    setIdx += 1;
    points.push({
      id: `live-${setIdx}`,
      label: setIdx === 1 ? 'Set 1' : `Set ${setIdx}`,
      k: metrics.k ?? undefined,
      cr: metrics.cr,
      kind: 'bmp',
    });
  }

  return points;
}
