import { STORAGE } from './storageKeys.js';

export const ATTENDING_STYLE_LEANS = [
  { id: 'physics', label: 'Physics', hint: 'Force, pressure, geometry, spatial inevitability' },
  { id: 'biochemistry', label: 'Biochemistry', hint: 'Pathways, receptors, enzymes, acid–base' },
  { id: 'abstraction', label: 'Abstraction', hint: 'Analogies and conceptual models — still patient-anchored' },
  {
    id: 'spirituality',
    label: 'Spiritual / meaning',
    hint: 'Values, faith, and human stakes when clinically relevant — never preach',
  },
];

export const ATTENDING_STYLE_SLOTS = ['a', 'b'];

export const ATTENDING_STYLE_PRESETS = [
  {
    id: 'balanced',
    label: 'Balanced',
    leans: { physics: 50, biochemistry: 50, abstraction: 50, spirituality: 50 },
  },
  {
    id: 'physics',
    label: 'Physics',
    leans: { physics: 88, biochemistry: 35, abstraction: 42, spirituality: 22 },
  },
  {
    id: 'biochemistry',
    label: 'Biochemistry',
    leans: { physics: 38, biochemistry: 88, abstraction: 40, spirituality: 28 },
  },
  {
    id: 'abstraction',
    label: 'Abstraction',
    leans: { physics: 40, biochemistry: 38, abstraction: 88, spirituality: 45 },
  },
  {
    id: 'spiritual',
    label: 'Meaning',
    leans: { physics: 32, biochemistry: 30, abstraction: 42, spirituality: 85 },
  },
];

const DEFAULT_LEANS = { physics: 50, biochemistry: 50, abstraction: 50, spirituality: 50 };

/** Slot A default — Steve: first attending talks too much at global Full arc. */
const DEFAULT_SLOT_A_DEPTH = 0;
/** Slot B default when no legacy global depth exists. */
const DEFAULT_SLOT_B_DEPTH = 3;

export const ATTENDING_STYLE_CHANGED = 'schoonmaker-attending-style-changed';

function normalizeDepth(n, fallback = DEFAULT_SLOT_B_DEPTH) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(3, Math.round(v)));
}

/** One-time migration from global first-opinion depth slider → slot B. */
function readLegacyGlobalFirstOpinionDepth() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE.firstOpinionDepth);
    if (raw == null) return null;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 3) return n;
  } catch {
    /* ignore */
  }
  return null;
}

function defaultSlotDepth(slotId, legacyGlobal = readLegacyGlobalFirstOpinionDepth()) {
  if (slotId === 'a') return DEFAULT_SLOT_A_DEPTH;
  return legacyGlobal != null ? legacyGlobal : DEFAULT_SLOT_B_DEPTH;
}

function defaultSlot(slotId) {
  return {
    label: slotId === 'a' ? 'Attending A' : 'Attending B',
    leans: { ...DEFAULT_LEANS },
    depth: defaultSlotDepth(slotId),
  };
}

function normalizeSlot(slotId, row, legacyGlobal = readLegacyGlobalFirstOpinionDepth()) {
  const base = defaultSlot(slotId);
  if (!row) return base;
  const depthFallback =
    row.depth != null
      ? defaultSlotDepth(slotId, legacyGlobal)
      : slotId === 'b' && legacyGlobal != null
        ? legacyGlobal
        : defaultSlotDepth(slotId, null);
  return {
    label: String(row.label || base.label).slice(0, 40),
    leans: normalizeLeans(row.leans),
    depth: row.depth != null ? normalizeDepth(row.depth, depthFallback) : depthFallback,
  };
}

function normalizeLean(n, fallback = 50) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function normalizeLeans(leans = {}) {
  return {
    physics: normalizeLean(leans.physics),
    biochemistry: normalizeLean(leans.biochemistry),
    abstraction: normalizeLean(leans.abstraction),
    spirituality: normalizeLean(leans.spirituality),
  };
}

export function readAttendingStylePrefs() {
  if (typeof localStorage === 'undefined') {
    return {
      activeSlot: 'a',
      slots: { a: defaultSlot('a'), b: defaultSlot('b') },
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE.attendingStylePrefs);
    if (!raw) {
      return {
        activeSlot: 'a',
        slots: { a: defaultSlot('a'), b: defaultSlot('b') },
      };
    }
    const parsed = JSON.parse(raw);
    const legacyGlobal = readLegacyGlobalFirstOpinionDepth();
    const slots = {
      a: normalizeSlot('a', parsed?.slots?.a, legacyGlobal),
      b: normalizeSlot('b', parsed?.slots?.b, legacyGlobal),
    };
    const activeSlot = ATTENDING_STYLE_SLOTS.includes(parsed?.activeSlot) ? parsed.activeSlot : 'a';
    return { activeSlot, slots };
  } catch {
    return {
      activeSlot: 'a',
      slots: { a: defaultSlot('a'), b: defaultSlot('b') },
    };
  }
}

export function writeAttendingStylePrefs(prefs) {
  const next = {
    activeSlot: ATTENDING_STYLE_SLOTS.includes(prefs?.activeSlot) ? prefs.activeSlot : 'a',
    slots: {
      a: normalizeSlot('a', prefs?.slots?.a),
      b: normalizeSlot('b', prefs?.slots?.b),
    },
  };
  try {
    localStorage.setItem(STORAGE.attendingStylePrefs, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ATTENDING_STYLE_CHANGED, { detail: next }));
  }
  return next;
}

export function readActiveAttendingStyleSlot() {
  return readAttendingStylePrefs().activeSlot;
}

export function readActiveAttendingStyleLeans() {
  const prefs = readAttendingStylePrefs();
  return { ...prefs.slots[prefs.activeSlot].leans };
}

export function readActiveAttendingDepth() {
  const prefs = readAttendingStylePrefs();
  return normalizeDepth(
    prefs.slots[prefs.activeSlot].depth,
    defaultSlotDepth(prefs.activeSlot),
  );
}

export function readAttendingDepthForSlot(slotId) {
  const prefs = readAttendingStylePrefs();
  if (!ATTENDING_STYLE_SLOTS.includes(slotId)) return DEFAULT_SLOT_A_DEPTH;
  return normalizeDepth(prefs.slots[slotId].depth, defaultSlotDepth(slotId));
}

export function patchActiveAttendingStyleDepth(depth) {
  const prefs = readAttendingStylePrefs();
  const slotId = prefs.activeSlot;
  const slot = prefs.slots[slotId];
  return writeAttendingStylePrefs({
    ...prefs,
    slots: {
      ...prefs.slots,
      [slotId]: {
        ...slot,
        depth: normalizeDepth(depth, slot.depth),
      },
    },
  });
}

export function setActiveAttendingStyleSlot(slotId) {
  const prefs = readAttendingStylePrefs();
  if (!ATTENDING_STYLE_SLOTS.includes(slotId)) return prefs;
  return writeAttendingStylePrefs({ ...prefs, activeSlot: slotId });
}

export function patchActiveAttendingStyleLeans(patch) {
  const prefs = readAttendingStylePrefs();
  const slotId = prefs.activeSlot;
  const slot = prefs.slots[slotId];
  return writeAttendingStylePrefs({
    ...prefs,
    slots: {
      ...prefs.slots,
      [slotId]: {
        ...slot,
        leans: normalizeLeans({ ...slot.leans, ...patch }),
      },
    },
  });
}

export function applyAttendingStylePreset(presetId) {
  const preset = ATTENDING_STYLE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return readAttendingStylePrefs();
  const prefs = readAttendingStylePrefs();
  const slotId = prefs.activeSlot;
  return writeAttendingStylePrefs({
    ...prefs,
    slots: {
      ...prefs.slots,
      [slotId]: {
        ...prefs.slots[slotId],
        leans: { ...preset.leans },
      },
    },
  });
}

/** Preset id when leans exactly match a preset row; null if custom slider mix. */
export function activeAttendingStylePresetId(leans = {}) {
  const n = normalizeLeans(leans);
  for (const preset of ATTENDING_STYLE_PRESETS) {
    const p = preset.leans;
    if (
      n.physics === p.physics &&
      n.biochemistry === p.biochemistry &&
      n.abstraction === p.abstraction &&
      n.spirituality === p.spirituality
    ) {
      return preset.id;
    }
  }
  return null;
}

/** Cache key fragment when attending leans change. */
export function attendingStyleFingerprint(leans = readActiveAttendingStyleLeans()) {
  const n = normalizeLeans(leans);
  return `p${n.physics}b${n.biochemistry}a${n.abstraction}s${n.spirituality}`;
}
