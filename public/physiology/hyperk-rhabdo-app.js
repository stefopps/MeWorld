'use strict';

/**
 * Case 118 Rhabdomyolysis — hyperK action potential demo (mobile).
 * Curves from action_potential_curves.js · pharmacology from hyperk_pharmacology.js
 */

const { REF, Y_ANCHORS, LABELS, SVG_K, SVG_NA, SVG_MV } = window.AP_FROM_SVG;

const AP_DURATION_MS = 6.5;
const tToMs = (t) => t * AP_DURATION_MS;
const msToT = (ms) => ms / AP_DURATION_MS;
const REST_FLAT_END_T = msToT(0.93);

const PHARM_ORDER = ['ca', 'insulin', 'albuterol', 'kcn'];
const { BANK: PHARM, CATEGORIES: PHARM_CAT, computeFromDoses } = window.HYPERK_PHARM_BANK;

const BASELINE_K = 6.8;
const K_NORMAL_LO = 3.5;
const K_NORMAL_HI = 5.0;

const restMvFromK = (k) => Math.max(-92, Math.min(-38, -75 + (k - 4.5) * 7.0));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmtSerumK = (k) => `${k.toFixed(1)} mEq/L`;
const fmtSerumKClinical = (k) => {
  const tag =
    k < K_NORMAL_LO
      ? ' (low)'
      : k <= K_NORMAL_HI
        ? ' (normal)'
        : k < 6.5
          ? ' (mild hyperK)'
          : ' (hyperK)';
  return `K⁺ ${fmtSerumK(k)}${tag} · normal ${K_NORMAL_LO}–${K_NORMAL_HI}`;
};

const ECG_LABELS = ['Normal', 'Peaked T', 'Wide QRS', 'Sine wave', 'VF/Asystole'];
const ecgStage = (k) => (k < 5.5 ? 0 : k < 6.5 ? 1 : k < 7.0 ? 2 : k < 8.0 ? 3 : 4);

const VW = REF.viewW;
const VH = REF.viewH;
const PL = REF.padL;
const PR = REF.padR;
const PT = REF.padT;
const PB = REF.padB;
const GW = REF.graphW;
const GH = REF.graphH;
const BY = REF.graphBottom;

const CURVE_STEPS = 1000;
const CARDINAL_TENSION = 0.35;
const ANIM_MS = 900;

function createNaturalCubicSpline(points) {
  const n = points.length;
  const x = points.map((p) => p[0]);
  const y = points.map((p) => p[1]);
  const h = [];
  const alpha = [];
  const l = [0];
  const mu = [0];
  const z = [0];
  for (let i = 0; i < n - 1; i++) h[i] = x[i + 1] - x[i];
  for (let i = 1; i < n - 1; i++)
    alpha[i] = (3 / h[i]) * (y[i + 1] - y[i]) - (3 / h[i - 1]) * (y[i] - y[i - 1]);
  l[0] = 1;
  mu[0] = 0;
  z[0] = 0;
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }
  l[n - 1] = 1;
  z[n - 1] = 0;
  const c = new Array(n);
  const b = new Array(n - 1);
  const d = new Array(n - 1);
  c[n - 1] = 0;
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (y[j + 1] - y[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  return function (xq) {
    const u = Math.max(x[0], Math.min(x[n - 1], xq));
    let i = 0;
    while (i < n - 2 && u > x[i + 1]) i++;
    i = Math.min(i, n - 2);
    const dx = u - x[i];
    return y[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx;
  };
}

const SPLINES = {
  mv: createNaturalCubicSpline(SVG_MV),
  na: createNaturalCubicSpline(SVG_NA),
  k: createNaturalCubicSpline(SVG_K),
};

function splineInterp(curveKey, t) {
  return SPLINES[curveKey](Math.max(0, Math.min(1, t)));
}

function curvePeak(arr, mode = 'max', tMin = 0, tMax = 1) {
  let best = { t: arr[0][0], mv: arr[0][1] };
  for (const [t, mv] of arr) {
    if (t < tMin || t > tMax) continue;
    if (mode === 'max' ? mv > best.mv : mv < best.mv) best = { t, mv };
  }
  return best;
}

const SVG_NA_PEAK = curvePeak(SVG_NA, 'max');

const ALIGN_KEY = 'ap-rhabdo-na-align-v1';
const DEFAULT_NA_ALIGN = {
  peakT: 0.312,
  basePeakT: SVG_NA_PEAK.t,
  width: 0.09,
};

let NA_ALIGN;
try {
  const saved = localStorage.getItem(ALIGN_KEY);
  NA_ALIGN = saved ? { ...DEFAULT_NA_ALIGN, ...JSON.parse(saved) } : { ...DEFAULT_NA_ALIGN };
} catch (_e) {
  NA_ALIGN = { ...DEFAULT_NA_ALIGN };
}

function saveNaAlign() {
  try {
    localStorage.setItem(ALIGN_KEY, JSON.stringify(NA_ALIGN));
  } catch (_e) {}
}

/** Na⁺ only — rigid slide along time (shape unchanged; does not warp Vm). */
function naSplineAt(t) {
  const dt = NA_ALIGN.peakT - NA_ALIGN.basePeakT;
  if (Math.abs(dt) < 1e-5) return splineInterp('na', t);
  return splineInterp('na', clamp(t - dt, 0, 1));
}

function mvToSvgY(mv) {
  for (let i = 0; i < Y_ANCHORS.length - 1; i++) {
    const a = Y_ANCHORS[i];
    const b = Y_ANCHORS[i + 1];
    if (mv <= a.mv && mv >= b.mv) {
      const f = (a.mv - mv) / (a.mv - b.mv || 1);
      return a.y + (b.y - a.y) * f;
    }
  }
  return mv > Y_ANCHORS[0].mv ? Y_ANCHORS[0].y : Y_ANCHORS[Y_ANCHORS.length - 1].y;
}

const mvY = (mv) => mvToSvgY(mv);
const tX = (t) => PL + t * GW;
const xT = (x) => (x - PL) / GW;

function mvFromSvgY(y) {
  for (let i = 0; i < Y_ANCHORS.length - 1; i++) {
    const a = Y_ANCHORS[i];
    const b = Y_ANCHORS[i + 1];
    if (y >= a.y && y <= b.y) {
      const f = (y - a.y) / (b.y - a.y || 1);
      return a.mv + (b.mv - a.mv) * f;
    }
  }
  return y < Y_ANCHORS[0].y ? Y_ANCHORS[0].mv : Y_ANCHORS[Y_ANCHORS.length - 1].mv;
}

function naPeakDisplay() {
  return { t: NA_ALIGN.peakT, mv: naSplineAt(NA_ALIGN.peakT) };
}

function cardinal(pts, ten = 0.42) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + ((p2.x - p0.x) / 6) * ten;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * ten;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * ten;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * ten;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)},${c2x.toFixed(1)} ${c2y.toFixed(1)},${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function valMv(key, t) {
  let v;
  if (key === 'na') v = naSplineAt(t);
  else if (key === 'mv' && t < REST_FLAT_END_T) v = -75;
  else v = splineInterp(key, t);
  if (key === 'mv' && S._mvOffset) v += S._mvOffset;
  return v;
}

function buildCurves(steps = CURVE_STEPS) {
  const mv = [];
  const na = [];
  const k = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = tX(t);
    mv.push({ x, y: mvY(valMv('mv', t)) });
    na.push({ x, y: mvY(valMv('na', t)) });
    k.push({ x, y: mvY(valMv('k', t)) });
  }
  return { mv, na, k };
}

function filled(pts, baseY = BY) {
  const c = cardinal(pts, CARDINAL_TENSION);
  return `${c} L${pts[pts.length - 1].x.toFixed(1)} ${baseY.toFixed(1)} L${pts[0].x.toFixed(1)} ${baseY.toFixed(1)} Z`;
}

function fmtMvLabel(mv) {
  const r = Math.round(mv);
  return (r > 0 ? '+' : '') + r + ' mV';
}

function naPermPctFromChartMv(chartMv) {
  return Math.round(Math.max(0, ((chartMv + 70.02) / 75.02) * 100));
}

function kPermPctFromChartMv(chartMv) {
  return Math.round(Math.max(0, ((chartMv + 70.02) / 32.01) * 100));
}

function effectiveDoses() {
  const d = {};
  for (const id of PHARM_ORDER) {
    d[id] = S.given[id] > 0 ? S.given[id] : Number(S.slider[id]) || 0;
  }
  return d;
}

function membraneStateFromDoses(doses, serumK = BASELINE_K) {
  const comp = computeFromDoses(doses, serumK);
  const rm = restMvFromK(comp.k);
  const tm = comp.thresholdMv;
  const gap = tm - rm;
  const normGap = -55 - restMvFromK(4.5);
  const pct = Math.round(clamp((gap / normGap) * 100, 0, 100));
  return {
    k: comp.k,
    rm,
    tm,
    gap,
    pct,
    ca: comp.calciumActive,
    danger: gap < 5,
    lines: comp.lines,
    doses: { ...doses },
  };
}

function membraneStateFromPharm() {
  return membraneStateFromDoses(effectiveDoses(), BASELINE_K);
}

function lerpMembraneState(a, b, t) {
  return {
    k: a.k + (b.k - a.k) * t,
    rm: a.rm + (b.rm - a.rm) * t,
    tm: a.tm + (b.tm - a.tm) * t,
    gap: a.gap + (b.gap - a.gap) * t,
    pct: Math.round(a.pct + (b.pct - a.pct) * t),
    ca: t < 0.5 ? a.ca : b.ca,
    danger: t < 0.5 ? a.danger : b.danger,
    lines: t >= 1 ? b.lines : a.lines,
    doses: b.doses,
  };
}

const S = {
  serumK: BASELINE_K,
  given: Object.fromEntries(PHARM_ORDER.map((id) => [id, 0])),
  slider: Object.fromEntries(PHARM_ORDER.map((id) => [id, 0])),
  focusDrug: null,
  curT: null,
  vis: { mv: true, na: true, k: true, rest: true },
  lightGraph: false,
  alignMode: false,
  drag: null,
  _mvOffset: 0,
};

const DEV_VIEW = new URLSearchParams(location.search).get('dev') === '1';
const GRAPH_ROLE_KEY = 'ap-graph-role-v1';
let graphRole = 'patient';
try {
  const savedRole = localStorage.getItem(GRAPH_ROLE_KEY);
  if (savedRole === 'attending') graphRole = 'attending';
} catch (_e) {}

if (DEV_VIEW) {
  document.body.classList.add('dev-view');
} else {
  S.alignMode = true;
}

function setGraphRole(role) {
  graphRole = role === 'attending' ? 'attending' : 'patient';
  try {
    localStorage.setItem(GRAPH_ROLE_KEY, graphRole);
  } catch (_e) {}
  syncGraphRoleUi();
}

function syncGraphRoleUi() {
  const isAttending = graphRole === 'attending';
  const thumb = document.getElementById('role-thumb');
  const btnP = document.getElementById('role-patient');
  const btnA = document.getElementById('role-attending');
  const tools = document.getElementById('attending-tools');
  if (thumb) thumb.style.transform = isAttending ? 'translateX(100%)' : 'translateX(0)';
  if (btnP) {
    btnP.classList.toggle('is-active', !isAttending);
    btnP.setAttribute('aria-selected', !isAttending ? 'true' : 'false');
  }
  if (btnA) {
    btnA.classList.toggle('is-active', isAttending);
    btnA.setAttribute('aria-selected', isAttending ? 'true' : 'false');
  }
  if (tools) tools.hidden = !isAttending;
  if (isAttending) updateNaAlignReadout();
}

let displayState = membraneStateFromPharm();
let animRaf = null;

const svg = document.getElementById('svg');
const wrap = document.getElementById('wrap');

function mk(tag, a, txt) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
  if (txt != null) e.textContent = txt;
  return e;
}

function addValueLabel(svgRoot, cx, cy, text, color, side = 'right') {
  const anchor = side === 'left' ? 'end' : 'start';
  const tx = cx + (side === 'left' ? -10 : 10);
  const tw = Math.max(28, text.length * 5.8 + 8);
  const rx = side === 'left' ? tx - tw + 2 : tx - 2;
  svgRoot.appendChild(
    mk('rect', {
      x: rx,
      y: cy - 9,
      width: tw,
      height: 16,
      rx: 4,
      class: 'inspect-label-bg',
    }),
  );
  svgRoot.appendChild(
    mk(
      'text',
      {
        x: tx,
        y: cy + 4,
        'text-anchor': anchor,
        fill: color,
        'font-size': '10',
        'font-weight': '700',
        'font-family': 'Archivo, sans-serif',
        class: 'inspect-label',
      },
      text,
    ),
  );
}

function cancelAnim() {
  if (animRaf) {
    cancelAnimationFrame(animRaf);
    animRaf = null;
  }
}

function animateToState(target) {
  cancelAnim();
  const from = { ...displayState };
  const start = performance.now();
  const tick = (now) => {
    const raw = Math.min(1, (now - start) / ANIM_MS);
    const eased = 1 - (1 - raw) ** 3;
    displayState = lerpMembraneState(from, target, eased);
    redraw();
    if (raw < 1) animRaf = requestAnimationFrame(tick);
    else {
      displayState = target;
      animRaf = null;
      redraw();
    }
  };
  animRaf = requestAnimationFrame(tick);
}

function previewNow() {
  cancelAnim();
  displayState = membraneStateFromPharm();
  redraw();
}

function dispState() {
  return displayState;
}

function drawSVG() {
  svg.innerHTML = '';
  const ds = dispState();
  S._mvOffset = ds.rm - -75;
  const C = buildCurves();
  const light = S.lightGraph;

  const defs = mk('defs', {});
  for (const [id, c1, c2] of [
    ['gMv', light ? 'rgba(28,78,122,.22)' : 'rgba(115,114,108,.18)', light ? 'rgba(28,78,122,.02)' : 'rgba(115,114,108,.02)'],
    ['gNa', light ? 'rgba(13,27,62,.22)' : 'rgba(55,138,221,.18)', light ? 'rgba(13,27,62,.02)' : 'rgba(55,138,221,.02)'],
    ['gK', light ? 'rgba(200,136,0,.28)' : 'rgba(239,159,39,.22)', light ? 'rgba(200,136,0,.03)' : 'rgba(239,159,39,.03)'],
  ]) {
    const g = mk('linearGradient', { id, x1: '0', y1: '0', x2: '0', y2: '1' });
    g.appendChild(mk('stop', { offset: '0%', 'stop-color': c1 }));
    g.appendChild(mk('stop', { offset: '100%', 'stop-color': c2 }));
    defs.appendChild(g);
  }
  svg.appendChild(defs);

  svg.appendChild(mk('rect', { x: 0, y: 0, width: VW, height: VH, fill: light ? '#fafafa' : '#0a0a0e' }));
  svg.appendChild(mk('rect', { x: PL, y: PT, width: GW, height: GH, fill: light ? '#ffffff' : '#0f0f14' }));

  const GRID_STROKE = light ? 'rgba(115,114,108,0.5)' : 'rgba(255,255,255,0.15)';
  const GRID_DASH = '3 3';
  const axisFill = light ? '#3d3d3a' : 'rgba(255,255,255,0.45)';
  const labelFill = light ? '#141413' : 'rgba(255,255,255,0.55)';
  const axisLine = light ? '#6a8090' : 'rgba(255,255,255,0.2)';
  const gridMv = [40, 0, -40, -55, -75, -100];
  for (const mv of gridMv) {
    const y = mvToSvgY(mv);
    svg.appendChild(
      mk('line', {
        x1: PL,
        y1: y,
        x2: PL + GW,
        y2: y,
        stroke: GRID_STROKE,
        'stroke-width': '0.5',
        'stroke-dasharray': GRID_DASH,
      }),
    );
    const lbl = mv > 0 ? `+${mv}` : String(mv);
    svg.appendChild(
      mk('text', {
        x: PL - 6,
        y: y + 4,
        'text-anchor': 'end',
        fill: axisFill,
        'font-size': '12',
        'font-family': 'Archivo, sans-serif',
      }, lbl),
    );
  }

  const permY = mvY(-75);
  svg.appendChild(
    mk('line', {
      x1: PL,
      y1: permY,
      x2: PL + GW,
      y2: permY,
      stroke: 'rgba(55,138,221,.25)',
      'stroke-width': '1',
      'stroke-dasharray': '2 4',
    }),
  );

  svg.appendChild(
    mk('text', {
      x: 18,
      y: 280,
      transform: 'rotate(-90 18 280)',
      'text-anchor': 'middle',
      fill: labelFill,
      'font-size': '14',
      'font-family': 'Archivo, sans-serif',
    }, 'Membrane potential (mV)'),
  );

  svg.appendChild(
    mk('line', { x1: PL, y1: PT, x2: PL, y2: BY, stroke: axisLine, 'stroke-width': '1.2' }),
  );
  svg.appendChild(
    mk('line', { x1: PL, y1: BY, x2: PL + GW, y2: BY, stroke: axisLine, 'stroke-width': '1.2' }),
  );

  for (let ms = 0; ms <= 6; ms++) {
    const x = tX(msToT(ms));
    svg.appendChild(
      mk('line', { x1: x, y1: BY, x2: x, y2: BY + 6, stroke: axisLine, 'stroke-width': '1' }),
    );
    svg.appendChild(
      mk('text', {
        x,
        y: BY + 20,
        'text-anchor': 'middle',
        fill: axisFill,
        'font-size': '11',
        'font-family': 'Archivo, sans-serif',
      }, String(ms)),
    );
  }
  svg.appendChild(
    mk('text', {
      x: 340,
      y: 500,
      'text-anchor': 'middle',
      fill: labelFill,
      'font-size': '14',
      'font-family': 'Archivo, sans-serif',
    }, 'Time (ms)'),
  );

  const ry = mvY(ds.rm);
  const ty = mvY(ds.tm);
  const pkBase = mvY(-70);

  if (S.vis.k) svg.appendChild(mk('path', { d: filled(C.k, pkBase), fill: 'url(#gK)' }));
  if (S.vis.na) svg.appendChild(mk('path', { d: filled(C.na, pkBase), fill: 'url(#gNa)' }));
  if (S.vis.mv) svg.appendChild(mk('path', { d: filled(C.mv), fill: 'url(#gMv)' }));

  if (S.vis.k)
    svg.appendChild(
      mk('path', {
        d: cardinal(C.k, CARDINAL_TENSION),
        fill: 'none',
        stroke: '#EF9F27',
        'stroke-width': '2',
        'stroke-linejoin': 'round',
      }),
    );
  if (S.vis.na)
    svg.appendChild(
      mk('path', {
        d: cardinal(C.na, CARDINAL_TENSION),
        fill: 'none',
        stroke: '#378ADD',
        'stroke-width': '2',
        'stroke-linejoin': 'round',
      }),
    );
  if (S.vis.mv)
    svg.appendChild(
      mk('path', {
        d: cardinal(C.mv, CARDINAL_TENSION),
        fill: 'none',
        stroke: '#73726c',
        'stroke-width': '2.2',
        'stroke-linejoin': 'round',
      }),
    );

  if (S.vis.rest) {
    svg.appendChild(
      mk('line', {
        x1: PL,
        y1: ry,
        x2: PL + GW,
        y2: ry,
        stroke: 'rgba(245,158,11,.2)',
        'stroke-width': '10',
        'stroke-linecap': 'round',
      }),
    );
    svg.appendChild(
      mk('line', {
        x1: PL,
        y1: ry,
        x2: PL + GW,
        y2: ry,
        stroke: '#f59e0b',
        'stroke-width': '4',
        'stroke-linecap': 'round',
      }),
    );
    svg.appendChild(
      mk('text', {
        x: PL + 8,
        y: ry - 8,
        'text-anchor': 'start',
        fill: '#f59e0b',
        'font-size': '11',
        'font-weight': '700',
        'font-family': 'Archivo, sans-serif',
      }, `Resting Vm ${Math.round(ds.rm)} mV`),
    );
  }

  const tc = ds.ca ? '#34d399' : '#60a5fa';
  svg.appendChild(
    mk('line', {
      x1: PL,
      y1: ty,
      x2: PL + GW,
      y2: ty,
      stroke: tc,
      'stroke-width': '1.5',
      'stroke-dasharray': '6 4',
      opacity: '0.9',
    }),
  );
  svg.appendChild(
    mk('text', {
      x: PL + GW - 3,
      y: ty - 5,
      'text-anchor': 'end',
      fill: tc,
      'font-size': '9',
      'font-family': 'Archivo, sans-serif',
    }, `Threshold ${Math.round(ds.tm)} mV`),
  );

  const L = LABELS;
  if (S.vis.mv)
    svg.appendChild(
      mk('text', {
        x: L.membrane.x,
        y: L.membrane.y,
        fill: 'rgba(255,255,255,0.65)',
        'font-size': '12',
        'font-weight': '600',
        'font-family': 'Archivo, sans-serif',
      }, 'Membrane potential'),
    );
  if (S.vis.na)
    svg.appendChild(
      mk('text', {
        x: L.na.x,
        y: L.na.y,
        fill: '#378ADD',
        'font-size': '12',
        'font-family': 'Archivo, sans-serif',
      }, 'Na⁺ relative permeability'),
    );
  if (S.vis.k)
    svg.appendChild(
      mk('text', {
        x: L.k.x,
        y: L.k.y,
        fill: '#EF9F27',
        'font-size': '12',
        'font-family': 'Archivo, sans-serif',
      }, 'K⁺ relative permeability'),
    );

  if (S.alignMode) {
    const np = naPeakDisplay();
    const hx = tX(np.t);
    const hy = mvY(np.mv);
    svg.appendChild(
      mk('circle', {
        cx: hx,
        cy: hy,
        r: 11,
        fill: 'none',
        stroke: '#378ADD',
        'stroke-width': '1.5',
        'stroke-dasharray': '3 2',
        class: 'align-handle',
        'data-handle': 'na-peak',
      }),
    );
    svg.appendChild(
      mk('circle', {
        cx: hx,
        cy: hy,
        r: 8,
        fill: '#378ADD',
        stroke: '#fff',
        'stroke-width': '2',
        class: 'align-handle',
        'data-handle': 'na-peak',
      }),
    );
    svg.appendChild(
      mk('text', {
        x: hx,
        y: hy - 12,
        'text-anchor': 'middle',
        fill: '#378ADD',
        'font-size': '10',
        'font-weight': '700',
        'font-family': 'Archivo, sans-serif',
      }, 'Na⁺ peak'),
    );
  }

  if (S.curT !== null && !S.drag) {
    const cx = tX(S.curT);
    const mv = valMv('mv', S.curT);
    const naMv = valMv('na', S.curT);
    const kMv = valMv('k', S.curT);
    svg.appendChild(
      mk('line', { x1: cx, y1: PT, x2: cx, y2: BY, stroke: 'rgba(255,255,255,0.2)', 'stroke-width': '1' }),
    );
    const dots = [];
    if (S.vis.mv) {
      const cy = mvY(mv);
      svg.appendChild(
        mk('circle', { cx, cy, r: '5', fill: '#73726c', stroke: 'white', 'stroke-width': '1.5' }),
      );
      dots.push({ cy, text: 'Vm ' + fmtMvLabel(mv), color: '#73726c' });
    }
    if (S.vis.na) {
      const cy = mvY(naMv);
      svg.appendChild(
        mk('circle', { cx, cy, r: '5', fill: '#378ADD', stroke: 'white', 'stroke-width': '1.5' }),
      );
      dots.push({ cy, text: 'Na⁺ ' + naPermPctFromChartMv(naMv) + '% open', color: '#378ADD' });
    }
    if (S.vis.k) {
      const cy = mvY(kMv);
      svg.appendChild(
        mk('circle', { cx, cy, r: '5', fill: '#EF9F27', stroke: 'white', 'stroke-width': '1.5' }),
      );
      dots.push({ cy, text: 'K⁺ perm ' + kPermPctFromChartMv(kMv) + '% open', color: '#EF9F27' });
    }
    dots.forEach((d, i) => {
      const side = i % 2 === 0 ? 'right' : 'left';
      addValueLabel(svg, cx, d.cy, d.text, d.color, side);
    });
    addValueLabel(svg, cx, PT + 12, tToMs(S.curT).toFixed(2) + ' ms', 'rgba(255,255,255,0.45)', 'right');
  }
}

function pharmEffectLabel(drug, id, dose, eff, ds) {
  if (dose <= 0) return eff.label;
  if (id === 'ca') return `Serum K⁺ ${fmtSerumK(ds.k)} unchanged · threshold ~${Math.round(ds.tm)} mV`;
  if (drug.lowersK) return `Serum K⁺ → ${fmtSerumK(ds.k)} · resting Vm → ${Math.round(ds.rm)} mV`;
  if (drug.raisesK) return `Serum K⁺ → ${fmtSerumK(ds.k)} · resting Vm → ${Math.round(ds.rm)} mV`;
  return eff.label;
}

function updateVitals() {
  const ds = dispState();
  const st = ecgStage(ds.k);
  const vserumk = document.getElementById('vserumk');
  if (vserumk) {
    vserumk.textContent = fmtSerumK(ds.k);
    vserumk.className = `vv ${ds.k > K_NORMAL_HI ? 'warn' : ds.danger ? 'crit' : 'ok'}`;
  }
  const vrest = document.getElementById('vrest');
  const vthr = document.getElementById('vthr');
  const vgap = document.getElementById('vgap');
  if (vrest) vrest.textContent = `${Math.round(ds.rm)} mV`;
  if (vthr) vthr.textContent = `${Math.round(ds.tm)} mV`;
  if (vgap) {
    vgap.textContent = `${ds.gap.toFixed(1)} mV`;
    vgap.className = `vv ${ds.danger ? 'crit' : ds.pct < 50 ? 'warn' : 'ok'}`;
  }
  const gf = document.getElementById('gfill');
  if (gf) {
    gf.style.width = `${ds.pct}%`;
    gf.style.background = ds.danger ? '#f87171' : ds.pct < 50 ? '#f59e0b' : '#34d399';
  }
  const gnote = document.getElementById('gnote');
  if (gnote)
    gnote.textContent = ds.danger
      ? '⚠ Critical gap — give calcium gluconate first'
      : ds.ca
        ? `✓ Ca²⁺ on board — threshold ${Math.round(ds.tm)} mV`
        : ds.pct < 60
          ? 'Reduced safety margin — rhabdo K⁺ load'
          : 'Safety gap adequate';
  const vecg = document.getElementById('vecg');
  if (vecg) vecg.textContent = ECG_LABELS[st];
  const hk = document.getElementById('head-k');
  if (hk) hk.textContent = fmtSerumKClinical(ds.k);
  const banner = document.getElementById('effect-banner-body');
  if (banner) {
    const parts = [
      `K⁺ <strong>${ds.k.toFixed(1)}</strong> mEq/L`,
      `rest <strong>${Math.round(ds.rm)}</strong> mV`,
      `thr <strong>${Math.round(ds.tm)}</strong> mV`,
      `gap <strong>${ds.gap.toFixed(1)}</strong> mV (${ds.pct}%)`,
    ];
    if (ds.lines.length) {
      const fx = ds.lines.map((l) => `${l.name.split(' ')[0]}: ${l.label}`).join(' · ');
      banner.innerHTML = parts.join(' · ') + '<br><span class="ap-effect-banner-sub">' + fx + '</span>';
    } else {
      banner.innerHTML =
        parts.join(' · ') +
        '<br><span class="ap-effect-banner-sub">Muscle breakdown releases K⁺ — adjust dose slider to preview, then Give</span>';
    }
  }
  const cap = document.getElementById('capbody');
  if (cap) {
    cap.innerHTML =
      `<strong>Rhabdomyolysis (Case 118):</strong> Serum ${fmtSerumKClinical(ds.k)}. Safety gap <strong>${ds.gap.toFixed(1)} mV</strong> (${ds.pct}% of normal)` +
      (ds.danger ? ' — <strong style="color:#f87171">critical narrowing</strong>' : '') +
      (ds.ca ? ' · <strong style="color:#34d399">Ca²⁺ stabilizing membrane</strong>' : '') +
      `. Resting <strong>${Math.round(ds.rm)} mV</strong>; threshold <strong>${Math.round(ds.tm)} mV</strong>.`;
  }
  updatePharmCardStates();
}

function updatePharmCardStates() {
  const ds = dispState();
  document.querySelectorAll('.pharm-card').forEach((card) => {
    const id = card.dataset.drug;
    if (!id) return;
    const drug = PHARM[id];
    if (!drug) return;
    const dose = S.given[id] > 0 ? S.given[id] : S.slider[id];
    const eff = drug.effect(dose);
    const valEl = card.querySelector('.pharm-dose-val');
    const effEl = card.querySelector('.pharm-effect');
    const btn = card.querySelector('.pharm-give');
    if (valEl) valEl.textContent = drug.formatDose(dose);
    if (effEl) effEl.textContent = pharmEffectLabel(drug, id, dose, eff, ds);
    card.classList.toggle('is-given', S.given[id] > 0);
    card.classList.toggle('is-preview', S.focusDrug === id || (!S.given[id] && dose > 0));
    if (btn) {
      if (S.given[id] > 0) {
        btn.textContent = 'Given';
        btn.classList.add('is-given');
      } else {
        btn.textContent = 'Give';
        btn.classList.remove('is-given');
      }
    }
  });
}

function redraw() {
  drawSVG();
  updateVitals();
}

function buildPharmCards() {
  const root = document.getElementById('pharm-cards');
  if (!root) return;
  let html = '';
  let lastCat = null;
  for (const id of PHARM_ORDER) {
    const drug = PHARM[id];
    if (drug.category !== lastCat) {
      html += `<div class="pharm-cat">${PHARM_CAT[drug.category]}</div>`;
      lastCat = drug.category;
    }
    const eff = drug.effect(0);
    html += `<div class="pharm-card" data-drug="${id}">
      <div class="pharm-card-head">
        <span class="pharm-name">${drug.name}</span>
        <button type="button" class="pharm-give" data-give="${id}">Give</button>
      </div>
      <div class="pharm-dose-row">
        <input type="range" class="pharm-slider" data-drug="${id}" min="${drug.doseMin}" max="${drug.doseMax}" step="${drug.doseStep}" value="0">
        <span class="pharm-dose-val">${drug.formatDose(0)}</span>
      </div>
      <div class="pharm-effect">${eff.label}</div>
      <p class="pharm-mechanism">${drug.mechanism}</p>
    </div>`;
  }
  root.innerHTML = html;

  root.querySelectorAll('.pharm-slider').forEach((sl) => {
    sl.addEventListener('input', () => {
      const id = sl.dataset.drug;
      S.slider[id] = Number(sl.value);
      S.focusDrug = id;
      previewNow();
    });
  });

  root.querySelectorAll('.pharm-give').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.give;
      const wasGiven = S.given[id] > 0;
      if (wasGiven) {
        S.given[id] = 0;
        S.slider[id] = 0;
        const sl = root.querySelector(`.pharm-slider[data-drug="${id}"]`);
        if (sl) sl.value = 0;
        animateToState(membraneStateFromPharm());
      } else {
        S.given[id] = Number(S.slider[id]) || PHARM[id].doseDefault;
        const sl = root.querySelector(`.pharm-slider[data-drug="${id}"]`);
        if (sl) sl.value = S.given[id];
        S.slider[id] = S.given[id];
        animateToState(membraneStateFromPharm());
      }
      updatePharmCardStates();
    });
  });
}

document.getElementById('resetbtn').addEventListener('click', () => {
  for (const id of PHARM_ORDER) {
    S.given[id] = 0;
    S.slider[id] = 0;
  }
  S.focusDrug = null;
  buildPharmCards();
  animateToState(membraneStateFromDoses({}, BASELINE_K));
});

document.querySelectorAll('.tog').forEach((b) => {
  b.addEventListener('click', function (e) {
    e.stopPropagation();
    const c = this.dataset.c;
    if (!c) return;
    const on = !S.vis[c];
    S.vis[c] = on;
    this.classList.toggle('off', !on);
    this.setAttribute('aria-pressed', on ? 'true' : 'false');
    updateShowAll();
    redraw();
  });
  if (!b.classList.contains('off')) b.setAttribute('aria-pressed', 'true');
});

function updateShowAll() {
  const all = S.vis.mv && S.vis.na && S.vis.k && S.vis.rest;
  const btn = document.getElementById('showallbtn');
  if (btn) btn.style.display = all ? 'none' : 'inline-flex';
}

document.getElementById('showallbtn')?.addEventListener('click', () => {
  S.vis = { mv: true, na: true, k: true, rest: true };
  document.querySelectorAll('.tog[data-c]').forEach((b) => {
    b.classList.remove('off');
    b.setAttribute('aria-pressed', 'true');
  });
  updateShowAll();
  redraw();
});

document.getElementById('theme-graph-btn')?.addEventListener('click', () => {
  S.lightGraph = !S.lightGraph;
  document.body.dataset.graph = S.lightGraph ? 'light' : 'dark';
  const btn = document.getElementById('theme-graph-btn');
  if (btn) {
    btn.textContent = S.lightGraph ? 'Graph: white' : 'Graph: dark';
    btn.classList.toggle('is-on', S.lightGraph);
    btn.setAttribute('aria-pressed', S.lightGraph ? 'true' : 'false');
  }
  redraw();
});

document.getElementById('align-mode-btn')?.addEventListener('click', () => {
  S.alignMode = !S.alignMode;
  const btn = document.getElementById('align-mode-btn');
  if (btn) {
    btn.textContent = 'Align Na⁺: ' + (S.alignMode ? 'ON' : 'OFF');
    btn.classList.toggle('is-on', S.alignMode);
    btn.setAttribute('aria-pressed', S.alignMode ? 'true' : 'false');
  }
  wrap.classList.toggle('align-mode', S.alignMode);
  if (S.alignMode) document.getElementById('panel-align')?.setAttribute('open', '');
  redraw();
});

function formatNaAlignReadout() {
  const base = NA_ALIGN.basePeakT ?? SVG_NA_PEAK.t;
  const peakT = NA_ALIGN.peakT;
  const shiftT = peakT - base;
  const peakMs = tToMs(peakT);
  const shiftMs = tToMs(shiftT);
  const sign = shiftMs >= 0 ? '+' : '';
  return {
    label: `Na⁺ peak ${peakMs.toFixed(2)} ms (${sign}${shiftMs.toFixed(2)} ms vs SVG)`,
    json: JSON.stringify({ peakT, basePeakT: base, shiftT }, null, 2),
  };
}

function updateNaAlignReadout() {
  const el = document.getElementById('na-align-readout');
  if (!el) return;
  const r = formatNaAlignReadout();
  el.textContent = r.label;
  el.title = `Saved as ${ALIGN_KEY}\n\n${r.json}`;
}

document.getElementById('role-patient')?.addEventListener('click', () => setGraphRole('patient'));
document.getElementById('role-attending')?.addEventListener('click', () => setGraphRole('attending'));
document.getElementById('align-copy-btn')?.addEventListener('click', () => {
  const r = formatNaAlignReadout();
  const btn = document.getElementById('align-copy-btn');
  navigator.clipboard.writeText(r.json).then(
    () => {
      if (btn) {
        btn.classList.add('is-ok');
        btn.lastChild.textContent = ' Copied';
        window.setTimeout(() => {
          btn.classList.remove('is-ok');
          if (btn.lastChild?.nodeType === 3) btn.lastChild.textContent = ' Copy';
        }, 2000);
      }
    },
    () => {},
  );
});

function applyNaAlignSlider() {
  const sl = document.getElementById('sl-na-t');
  const vl = document.getElementById('vl-na-t');
  if (sl) sl.value = Math.round(NA_ALIGN.peakT * 1000);
  if (vl) vl.textContent = tToMs(NA_ALIGN.peakT).toFixed(2) + ' ms';
  saveNaAlign();
  updateNaAlignReadout();
}

document.getElementById('sl-na-t')?.addEventListener('input', (e) => {
  NA_ALIGN.peakT = Number(e.target.value) / 1000;
  applyNaAlignSlider();
  redraw();
});

document.getElementById('align-reset-btn')?.addEventListener('click', () => {
  NA_ALIGN = { ...DEFAULT_NA_ALIGN };
  applyNaAlignSlider();
  redraw();
});

document.getElementById('align-copy-btn')?.addEventListener('click', () => {
  navigator.clipboard.writeText(JSON.stringify(NA_ALIGN, null, 2)).catch(() => {});
});

function svgPointFromEvent(e) {
  const r = svg.getBoundingClientRect();
  const cx = e.clientX != null ? e.clientX : 0;
  const cy = e.clientY != null ? e.clientY : 0;
  return {
    x: clamp(((cx - r.left) / r.width) * VW, 0, VW),
    y: clamp(((cy - r.top) / r.height) * VH, 0, VH),
  };
}

function hitAlignHandle(pt) {
  if (!S.alignMode) return null;
  const np = naPeakDisplay();
  const hx = tX(np.t);
  const hy = mvY(np.mv);
  if (Math.hypot(pt.x - hx, pt.y - hy) <= 16) return { id: 'na-peak' };
  return null;
}

function getT(e) {
  const r = svg.getBoundingClientRect();
  const cx = e.clientX != null ? e.clientX : e.touches ? e.touches[0].clientX : 0;
  return clamp(xT(((cx - r.left) / r.width) * VW), 0, 1);
}

wrap.addEventListener('pointerdown', (e) => {
  if (S.alignMode) {
    const pt = svgPointFromEvent(e);
    const hit = hitAlignHandle(pt);
    if (hit) {
      S.drag = hit.id;
      document.addEventListener('pointermove', onDocPointerMove);
      document.addEventListener('pointerup', onDocPointerUp);
      document.addEventListener('pointercancel', onDocPointerUp);
      e.preventDefault();
      return;
    }
  }
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  S.curT = getT(e);
  redraw();
});

function onDocPointerMove(e) {
  if (S.drag === 'na-peak') {
    const pt = svgPointFromEvent(e);
    NA_ALIGN.peakT = clamp(xT(pt.x), 0, 1);
    applyNaAlignSlider();
    redraw();
    return;
  }
  S.curT = getT(e);
  redraw();
}

function onDocPointerUp() {
  S.drag = null;
  document.removeEventListener('pointermove', onDocPointerMove);
  document.removeEventListener('pointerup', onDocPointerUp);
  document.removeEventListener('pointercancel', onDocPointerUp);
}

wrap.addEventListener('pointermove', (e) => {
  if (S.drag) return;
  S.curT = getT(e);
  redraw();
});

wrap.addEventListener('pointerleave', () => {
  if (!S.drag) {
    S.curT = null;
    redraw();
  }
});

const CLINICAL_PREFS_KEY = 'schoonmaker_clinical_text_prefs';
const TEACH_ME_PREFS_KEY = 'schoonmaker_teach_me_text_prefs';

function applyMeWorldTextPrefs() {
  const root = document.getElementById('root-panel');
  if (!root) return;
  let cScale = 1.38;
  let cWeight = 600;
  let tScale = 1.24;
  let tWeight = 500;
  try {
    const c = JSON.parse(localStorage.getItem(CLINICAL_PREFS_KEY) || 'null');
    if (c && Number.isFinite(c.fontScale)) cScale = Math.min(2, Math.max(0.9, c.fontScale));
    if (c && [500, 600, 700].includes(c.weight)) cWeight = c.weight;
  } catch (_e) {
    /* ignore */
  }
  try {
    const t = JSON.parse(localStorage.getItem(TEACH_ME_PREFS_KEY) || 'null');
    if (t && Number.isFinite(t.fontScale)) tScale = Math.min(1.5, Math.max(0.9, t.fontScale));
    if (t && [500, 600, 700].includes(t.weight)) tWeight = t.weight;
  } catch (_e) {
    /* ignore */
  }
  root.style.setProperty('--clinical-font-size', `${Math.round(16 * cScale)}px`);
  root.style.setProperty('--clinical-font-weight', String(cWeight));
  root.style.setProperty('--teach-me-font-size', `${Math.round(12 * tScale)}px`);
  root.style.setProperty('--teach-me-font-weight', String(tWeight));
}

applyMeWorldTextPrefs();
applyNaAlignSlider();
syncGraphRoleUi();
if (!DEV_VIEW && wrap) wrap.classList.add('align-mode');
buildPharmCards();
displayState = membraneStateFromPharm();
updateShowAll();
redraw();
