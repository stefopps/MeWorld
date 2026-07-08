import { STORAGE } from './storageKeys.js';

const DEFAULTS = {
  monitorVolume: 0.23,
  sfxVolume: 0.55,
  voiceVolume: 1,
  monitorMuted: false,
  voiceMuted: false,
  patientAutoSpeak: false,
  attendingAutoSpeak: false,
  allowBrowserSpeechFallback: true,
  monitorEnabled: true,
};

function clamp01(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

export function readAudioPrefs() {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE.audioPrefs);
    if (!raw) return { ...DEFAULTS };
    const parsed = { ...DEFAULTS, ...JSON.parse(raw) };
    return {
      ...parsed,
      monitorVolume: clamp01(parsed.monitorVolume, DEFAULTS.monitorVolume),
      sfxVolume: clamp01(parsed.sfxVolume, DEFAULTS.sfxVolume),
      voiceVolume: clamp01(parsed.voiceVolume, DEFAULTS.voiceVolume),
      monitorMuted: Boolean(parsed.monitorMuted),
      voiceMuted: Boolean(parsed.voiceMuted),
      patientAutoSpeak: parsed.patientAutoSpeak === true,
      attendingAutoSpeak: parsed.attendingAutoSpeak === true,
      allowBrowserSpeechFallback: parsed.allowBrowserSpeechFallback !== false,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeAudioPrefs(prefs) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE.audioPrefs, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function patchAudioPrefs(patch) {
  const next = { ...readAudioPrefs(), ...patch };
  writeAudioPrefs(next);
  return next;
}
