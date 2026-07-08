import { STORAGE } from './storageKeys.js';

const MIN_W = 260;
const MIN_H = 10;
const DOCK_HANDLE_PX = 24;
const MIN_CLINICAL = 0;
const MIN_STACKS = 0;
const MIN_STACKS_LIST = 10;
const MAX_STACKS_LIST = 720;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export const DOCK_CHROME_COLLAPSED_HEIGHT = 148;

// Steve manual dock lock — Play + Briefing preview share PLAY_DOCK_SPEC.
// 2026-06-30 @ 996×996: wRatio 0.269, xCenter 0.807, yTop 0.044, aspect 368/199.
const PLAY_DOCK_SPEC = {
  wRatio: 0.269,
  aspect: 368 / 199,
  clinicalFrac: 161 / 187,
  xCenterFrac: 0.807,
  yFrac: 0.044,
  rightRailPx: 56,
  fixedRatio: true,
};
/** Case preview (Briefing) uses the same dock size/position as Play. */
const BRIEFING_DOCK_SPEC = PLAY_DOCK_SPEC;

function buildDockLayout(spec) {
  const ssr = typeof window === 'undefined';
  const vw = ssr ? 1280 : window.innerWidth;
  const vh = ssr ? 800 : window.innerHeight;
  const compact = vw <= 900 && !spec.fixedRatio;
  // Slightly wider fraction on small screens so it stays usable.
  let width = compact
    ? clamp(Math.round(vw * (spec.wRatio + 0.2)), 300, vw - 16)
    : clamp(Math.round(vw * spec.wRatio), 320, 820);
  let height = Math.round(width / spec.aspect);
  // Safety cap — never taller than ~42% of the viewport (skip when ratio is author-locked).
  const maxH = Math.round(vh * (spec.fixedRatio ? 0.55 : 0.42));
  if (height > maxH) {
    height = maxH;
    width = clamp(Math.round(height * spec.aspect), MIN_W, vw - 24);
  }
  const rightRail = spec.rightRailPx ?? 56;
  const rightPad = spec.fixedRatio ? 8 : rightRail + 12;
  const x =
    spec.xCenterFrac != null
      ? clamp(
          Math.round(vw * spec.xCenterFrac - width / 2),
          16,
          Math.max(16, vw - width - rightPad),
        )
      : compact
        ? 8
        : 16;
  const y =
    spec.yFrac != null
      ? clamp(Math.round(vh * spec.yFrac), 44, Math.max(44, vh - height - 8))
      : compact
        ? Math.max(44, vh - height - 52)
        : 52;
  const clinicalPx = clamp(
    Math.round(height * spec.clinicalFrac),
    0,
    Math.max(0, height - DOCK_HANDLE_PX - 4),
  );
  return { x, y, width, height, clinicalPx, stacksListPx: 0 };
}

export function defaultPlayDockLayout() {
  return buildDockLayout(PLAY_DOCK_SPEC);
}

export function defaultBriefingDockLayout() {
  return buildDockLayout(BRIEFING_DOCK_SPEC);
}

export function isDockLayoutOnScreen(layout) {
  if (typeof window === 'undefined') return true;
  const margin = 48;
  return (
    layout.x >= -layout.width + margin &&
    layout.y >= 0 &&
    layout.x <= window.innerWidth - margin &&
    layout.y <= window.innerHeight - margin
  );
}

export function playDockStorageKey(caseId) {
  const raw = String(caseId ?? '').trim();
  if (!raw) return STORAGE.playDockLayout;
  const key = /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw;
  return `${STORAGE.playDockLayout}_${key}`;
}

export function readPlayDockLayout(storageKey = STORAGE.playDockLayout) {
  try {
    const raw = localStorage.getItem(storageKey);
    const fallback =
      storageKey === STORAGE.briefingDockLayout
        ? defaultBriefingDockLayout()
        : defaultPlayDockLayout();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const base = fallback;
    const layout = {
      x: Number(parsed.x) || base.x,
      y: Number(parsed.y) || base.y,
      width: clamp(Number(parsed.width) || base.width, MIN_W, window.innerWidth - 8),
      height: clamp(Number(parsed.height) || base.height, MIN_H, window.innerHeight - 44),
      clinicalPx: Number(parsed.clinicalPx) || base.clinicalPx,
      stacksListPx: Number(parsed.stacksListPx) || 0,
    };
    const clamped = clampDockLayout(layout);
    if (!isDockLayoutOnScreen(clamped)) return fallback;
    return clamped;
  } catch {
    return storageKey === STORAGE.briefingDockLayout
      ? defaultBriefingDockLayout()
      : defaultPlayDockLayout();
  }
}

export function writePlayDockLayout(layout, storageKey = STORAGE.playDockLayout) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

export function clampDockLayout(layout) {
  const maxW = Math.max(MIN_W, window.innerWidth - 8);
  const maxH = Math.max(MIN_H, window.innerHeight - 44);
  const width = clamp(layout.width, MIN_W, maxW);
  const height = clamp(layout.height, MIN_H, maxH);
  const x = clamp(layout.x, 8, Math.max(8, window.innerWidth - width - 8));
  const y = clamp(layout.y, 44, Math.max(44, window.innerHeight - height - 8));
  const contentH = Math.max(0, height - DOCK_HANDLE_PX);
  const clinicalPx = clamp(
    layout.clinicalPx,
    MIN_CLINICAL,
    Math.max(MIN_CLINICAL, contentH - 8),
  );
  const stacksRaw = Number(layout.stacksListPx) || 0;
  const stacksMax = Math.max(0, contentH - clinicalPx - 8);
  const stacksListPx =
    stacksRaw <= 0
      ? 0
      : clamp(stacksRaw, MIN_STACKS_LIST, Math.min(MAX_STACKS_LIST, stacksMax));
  return { x, y, width, height, clinicalPx, stacksListPx };
}

export { MIN_W, MIN_H, DOCK_HANDLE_PX, MIN_CLINICAL, MIN_STACKS, MIN_STACKS_LIST, MAX_STACKS_LIST };
