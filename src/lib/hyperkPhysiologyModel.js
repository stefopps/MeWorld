/**
 * Simplified cardiac membrane model for hyperK trajectory teaching.
 * High K+ depolarizes resting potential; calcium widens the safety gap (threshold more negative).
 */
export function hyperkMembraneState({ k = 4.2, calciumStabilized = false } = {}) {
  const serumK = Number(k) || 4.2;
  const restingMv = clamp(-90 + (serumK - 4.0) * 7.5, -58, -92);
  const thresholdMv = calciumStabilized ? -78 : -66;
  const gapMv = thresholdMv - restingMv;
  const safetyPct = clamp(Math.round((gapMv / 24) * 100), 0, 100);
  return {
    k: serumK,
    restingMv,
    thresholdMv,
    gapMv,
    safetyPct,
    calciumStabilized,
    danger: gapMv < 8,
  };
}

export function orderLogHasCalcium(orderLog = []) {
  return orderLog.some((e) => /calcium/i.test(e?.label || ''));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Lerp between membrane states for animation frames. */
export function lerpMembraneState(a, b, t) {
  const u = clamp(t, 0, 1);
  return hyperkMembraneState({
    k: a.k + (b.k - a.k) * u,
    calciumStabilized: u < 0.5 ? a.calciumStabilized : b.calciumStabilized,
  });
}
