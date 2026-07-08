import { SVG_NA, svgInterp } from './actionPotentialSvgCurves.js';

export const NA_ALIGN_STORAGE_KEY = 'ap-rhabdo-na-align-v1';
export const AP_DURATION_MS = 6.5;

export const DEFAULT_NA_ALIGN = {
  peakT: 0.312,
  width: 0.09,
};

function curvePeak(arr) {
  let best = { t: arr[0][0], mv: arr[0][1] };
  for (let i = 1; i < arr.length; i += 1) {
    if (arr[i][1] > best.mv) best = { t: arr[i][0], mv: arr[i][1] };
  }
  return best;
}

const SVG_NA_PEAK = curvePeak(SVG_NA);

/** Slide entire Na⁺ curve along time — shape unchanged, only horizontal shift. */
export function svgNaMvAligned(t, align = DEFAULT_NA_ALIGN) {
  const basePeakT = align.basePeakT ?? SVG_NA_PEAK.t;
  const peakT = align.peakT ?? DEFAULT_NA_ALIGN.peakT;
  const dt = peakT - basePeakT;
  if (Math.abs(dt) < 1e-5) return svgInterp(SVG_NA, t);
  return svgInterp(SVG_NA, Math.max(0, Math.min(1, t - dt)));
}

export function loadNaAlign() {
  try {
    const raw = localStorage.getItem(NA_ALIGN_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_NA_ALIGN, basePeakT: SVG_NA_PEAK.t };
    }
    const saved = JSON.parse(raw);
    return { ...DEFAULT_NA_ALIGN, basePeakT: SVG_NA_PEAK.t, ...saved };
  } catch (_e) {
    return { ...DEFAULT_NA_ALIGN, basePeakT: SVG_NA_PEAK.t };
  }
}

export function saveNaAlign(align) {
  try {
    localStorage.setItem(NA_ALIGN_STORAGE_KEY, JSON.stringify(align));
  } catch (_e) {
    /* ignore */
  }
}

export function naPeakDisplay(align) {
  const peakT = align.peakT ?? DEFAULT_NA_ALIGN.peakT;
  return { t: peakT, mv: svgNaMvAligned(peakT, align) };
}

/** Human + machine readout for the current Na⁺ time slide. */
export function formatNaAlignReadout(align = DEFAULT_NA_ALIGN) {
  const basePeakT = align.basePeakT ?? SVG_NA_PEAK.t;
  const peakT = align.peakT ?? DEFAULT_NA_ALIGN.peakT;
  const shiftT = peakT - basePeakT;
  const peakMs = peakT * AP_DURATION_MS;
  const shiftMs = shiftT * AP_DURATION_MS;
  const sign = shiftMs >= 0 ? '+' : '';
  return {
    peakT,
    basePeakT,
    shiftT,
    peakMs,
    shiftMs,
    label: `Na⁺ peak ${peakMs.toFixed(2)} ms (${sign}${shiftMs.toFixed(2)} ms vs SVG)`,
    storageKey: NA_ALIGN_STORAGE_KEY,
    json: JSON.stringify({ peakT, basePeakT, shiftT }, null, 2),
  };
}
