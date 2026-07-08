/**
 * Tunable conduction timeline → dipole vector + active pathway segments.
 * Teaching model — parametric, not cell-level simulation.
 */

var PHASES = [
  { id: 'p', start: 0, end: 0.15 },
  { id: 'pr', start: 0.15, end: 0.25 },
  { id: 'qrs', start: 0.25, end: 0.4 },
  { id: 'st', start: 0.4, end: 0.65 },
  { id: 't', start: 0.65, end: 1.0 },
];

var PRESET_DELAYS = {
  normal: { lbb: 0, rbb: 0, axisOff: 0 },
  lad: { lbb: 0, rbb: 0, axisOff: -45 },
  rad: { lbb: 0, rbb: 0, axisOff: 60 },
  lbbb: { lbb: 0.08, rbb: 0, axisOff: -15 },
  rbbb: { lbb: 0, rbb: 0.08, axisOff: 15 },
};

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function phaseAt(u) {
  u = clamp01(u);
  for (var i = 0; i < PHASES.length; i++) {
    if (u >= PHASES[i].start && u < PHASES[i].end) return PHASES[i];
  }
  return PHASES[PHASES.length - 1];
}

function phaseLocal(u, ph) {
  return clamp01((u - ph.start) / Math.max(0.001, ph.end - ph.start));
}

function waveMag(phId, local) {
  if (phId === 'p') return 0.22 * Math.sin(local * Math.PI);
  if (phId === 'pr') return 0.02;
  if (phId === 'qrs') return 0.95 * Math.pow(Math.sin(local * Math.PI), 0.65);
  if (phId === 'st') return 0.04;
  if (phId === 't') return 0.35 * Math.sin(local * Math.PI);
  return 0;
}

function effectiveAxisDeg(params) {
  var preset = PRESET_DELAYS[params.preset] || PRESET_DELAYS.normal;
  return (params.axisDeg != null ? params.axisDeg : 60) + (preset.axisOff || 0);
}

function dipoleFromAxis(deg, mag) {
  var a = (deg * Math.PI) / 180;
  return { vx: Math.cos(a) * mag, vy: Math.sin(a) * mag, on: mag > 0.02 };
}

function activeSegments(phId, local, params) {
  var preset = PRESET_DELAYS[params.preset] || PRESET_DELAYS.normal;
  if (phId === 'p') return local < 0.5 ? ['sa'] : ['atria'];
  if (phId === 'pr') return ['av'];
  if (phId === 'qrs') {
    var segs = ['his'];
    if (local < 0.35 + preset.lbb) segs.push('lbb');
    if (local < 0.35 + preset.rbb) segs.push('rbb');
    if (local > 0.25) segs.push('purkinje');
    if (local > 0.4) segs.push('ventricles');
    return segs;
  }
  if (phId === 'st') return [];
  if (phId === 't') return local < 0.55 ? ['ventricles'] : ['purkinje'];
  return [];
}

export function conductionSample(cyclePhase, params) {
  params = params || {};
  var u = clamp01(cyclePhase);
  var ph = phaseAt(u);
  var local = phaseLocal(u, ph);
  var mag = waveMag(ph.id, local);
  var axis = effectiveAxisDeg(params);
  if (ph.id === 'p') axis = 75;
  if (ph.id === 't') axis = effectiveAxisDeg(params) * 0.85;
  return {
    wave: ph.id,
    activeSegments: activeSegments(ph.id, local, params),
    dipole: dipoleFromAxis(axis, mag),
  };
}

export function conductionPresetIds() {
  return Object.keys(PRESET_DELAYS);
}
