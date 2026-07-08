/** Neuron action potential — SVG-sampled curves (neuron_action_potential_v2.svg). */

import {
  AP_SVG_MV_MAX,
  AP_SVG_MV_MIN,
  AP_SVG_PHASE_T,
  AP_SVG_PERM_BASELINE_MV,
  naPermPercentFromMv,
  kPermPercentFromMv,
  svgInterp,
  SVG_K,
  SVG_MV,
  SVG_NA,
  svgKMv,
  svgMembraneMv,
  svgNaMv,
} from './actionPotentialSvgCurves.js';
import { loadNaAlign, svgNaMvAligned } from './naCurveAlign.js';

export const AP_MV_MIN = AP_SVG_MV_MIN;
export const AP_MV_MAX = AP_SVG_MV_MAX;
export const AP_RESTING_MV = -75;
export const AP_THRESHOLD_MV = -55;

/** Interactive teaching phases — t aligned to v2 SVG numbered markers. */
export const AP_PHASES = [
  {
    id: 1,
    key: 'resting',
    short: 'Resting',
    label: 'Resting membrane potential',
    t: AP_SVG_PHASE_T[1],
    description:
      'Both voltage-gated Na⁺ and K⁺ channels closed. Membrane more permeable to K⁺ at rest — resting near −75 mV. In hyperK the resting potential depolarises and the safety gap narrows.',
    na: { activation: 'closed', inactivation: 'open' },
    k: { activation: 'closed' },
  },
  {
    id: 2,
    key: 'depolarization',
    short: 'Depolarization',
    label: 'Membrane depolarization',
    t: AP_SVG_PHASE_T[2],
    description:
      'Na⁺ activation gate opens — Na⁺ rushes in. Membrane potential races toward threshold and peak (+40 mV).',
    na: { activation: 'open', inactivation: 'open' },
    k: { activation: 'closed' },
  },
  {
    id: 3,
    key: 'repolarization',
    short: 'Repolarization',
    label: 'Membrane repolarization',
    t: AP_SVG_PHASE_T[3],
    description:
      'At peak: Na⁺ inactivation gate closes. K⁺ activation gate opens — K⁺ efflux drives potential back down.',
    na: { activation: 'closed', inactivation: 'closed' },
    k: { activation: 'open' },
  },
  {
    id: 4,
    key: 'hyperpolarization',
    short: 'Hyperpolarization',
    label: 'Membrane hyperpolarization',
    t: AP_SVG_PHASE_T[4],
    description:
      'K⁺ gates slow to close — brief undershoot below rest. Na⁺ channels reset; Na⁺/K⁺ pump restores ion gradients.',
    na: { activation: 'closed', inactivation: 'open' },
    k: { activation: 'open-slow' },
  },
];

export function membranePotentialMv(t, { restingOffsetMv = 0 } = {}) {
  return svgMembraneMv(t, restingOffsetMv);
}

/** Relative permeability 0–1 for channel diagram (derived from SVG y-scale). */
export function naPermeability(t) {
  return naPermPercentFromMv(svgNaMv(t)) / 100;
}

export function kPermeability(t) {
  return kPermPercentFromMv(svgKMv(t)) / 100;
}

export function sampleActionPotentialCurves({
  steps = 96,
  restingOffsetMv = 0,
  naAlign = null,
} = {}) {
  const align = naAlign || loadNaAlign();
  const membrane = [];
  const na = [];
  const k = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    membrane.push({ t, mv: svgMembraneMv(t, restingOffsetMv) });
    na.push({ t, mv: svgNaMvAligned(t, align) });
    k.push({ t, mv: svgKMv(t) });
  }
  return { membrane, na, k };
}

export { DEFAULT_NA_ALIGN, loadNaAlign, saveNaAlign, svgNaMvAligned, naPeakDisplay, formatNaAlignReadout, AP_DURATION_MS, NA_ALIGN_STORAGE_KEY } from './naCurveAlign.js';

export function phaseById(id) {
  return AP_PHASES.find((p) => p.id === id) || AP_PHASES[0];
}

export function phaseAtT(t) {
  let best = AP_PHASES[0];
  let bestDist = Infinity;
  for (const phase of AP_PHASES) {
    const d = Math.abs(phase.t - t);
    if (d < bestDist) {
      bestDist = d;
      best = phase;
    }
  }
  return best;
}

export {
  AP_SVG_PHASE_T,
  AP_SVG_PERM_BASELINE_MV,
  naPermPercentFromMv,
  kPermPercentFromMv,
  svgInterp,
  SVG_K,
  SVG_MV,
  SVG_NA,
};
