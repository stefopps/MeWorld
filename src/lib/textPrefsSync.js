/** Broadcast clinical / Teach Me font prefs changes across Briefing, Play, Differential, settings. */
export const TEXT_PREFS_CHANGED = 'meworld-text-prefs-changed';

export function notifyTextPrefsChanged(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TEXT_PREFS_CHANGED, { detail }));
}
