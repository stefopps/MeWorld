import { STORAGE } from './storageKeys.js';
import { defaultPlayDockLayout, writePlayDockLayout } from './playDockLayout.js';

/** Canonical play UI — wide stacks, scene monitor dock, notes session foot. */
export const PLAY_UI_FAVORITE = {
  id: 'wide-stacks-v1',
  label: 'Wide stacks + scene monitor',
  savedAt: '2026-06-02T00:00:00.000Z',
  infoTab: 'treatment',
  stacksVisible: false,
  dockToolbarCollapsed: true,
  dockCollapsed: false,
};

export function readPlayUiFavorite() {
  try {
    const raw = localStorage.getItem(STORAGE.playUiFavorite);
    if (!raw) return { ...PLAY_UI_FAVORITE };
    const parsed = JSON.parse(raw);
    return {
      ...PLAY_UI_FAVORITE,
      ...parsed,
      infoTab:
        parsed?.infoTab === 'notes' || parsed?.infoTab === 'chat'
          ? 'chat'
          : parsed?.infoTab === 'hpi' || parsed?.infoTab === 'exam' || parsed?.infoTab === 'treatment'
            ? parsed.infoTab
            : 'treatment',
    };
  } catch {
    return { ...PLAY_UI_FAVORITE };
  }
}

export function savePlayUiFavorite(patch = {}) {
  const next = {
    ...readPlayUiFavorite(),
    ...patch,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE.playUiFavorite, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** Persist favorite dock layout + tab defaults for this device. */
export function applyPlayUiFavorite({ dockLayout = null } = {}) {
  const favorite = savePlayUiFavorite({
    dockLayout: dockLayout || defaultPlayDockLayout(),
  });
  if (favorite.dockLayout) {
    writePlayDockLayout(favorite.dockLayout, STORAGE.playDockLayout);
  }
  return favorite;
}

export function isPlayUiFavoriteActive() {
  try {
    return localStorage.getItem(STORAGE.playUiFavorite) != null;
  } catch {
    return false;
  }
}

/** One-time seed so new sessions open on the favorite layout. */
export function ensurePlayUiFavoriteSeeded() {
  if (typeof window === 'undefined') return readPlayUiFavorite();
  if (isPlayUiFavoriteActive()) return readPlayUiFavorite();
  return applyPlayUiFavorite();
}
