import { readAudioPrefs } from './audioPrefs.js';
import { apiUrl } from './apiBase.js';

let readerEl = null;
let readerAbort = null;
let readerGen = 0;
let speechUtterance = null;

function targetVoiceVolume() {
  const prefs = readAudioPrefs();
  if (prefs.voiceMuted) return 0;
  return Math.max(0, Math.min(1, prefs.voiceVolume ?? 0.85));
}

export function applyCaseReaderVolume() {
  const volume = targetVoiceVolume();
  if (readerEl) readerEl.volume = volume;
  if (speechUtterance) speechUtterance.volume = volume;
}

function stopReader() {
  if (readerEl) {
    readerEl.pause();
    readerEl.currentTime = 0;
    readerEl.onended = null;
    readerEl.onerror = null;
    readerEl = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  speechUtterance = null;
  if (readerAbort) {
    readerAbort.abort();
    readerAbort = null;
  }
  readerGen += 1;
}

export function getReaderState() {
  if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) return 'playing';
  if (!readerEl) return 'idle';
  return readerEl.paused ? 'idle' : 'playing';
}

function playUrl(url, signal) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.volume = targetVoiceVolume();
    readerEl = audio;

    const cleanup = () => {
      audio.onended = null;
      audio.onerror = null;
      if (readerEl === audio) readerEl = null;
    };

    if (signal?.aborted) {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const onAbort = () => {
      audio.pause();
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    audio.onended = () => {
      signal?.removeEventListener('abort', onAbort);
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      signal?.removeEventListener('abort', onAbort);
      cleanup();
      reject(new Error('Playback failed'));
    };

    audio.play().catch((err) => {
      signal?.removeEventListener('abort', onAbort);
      cleanup();
      reject(err);
    });
  });
}

async function playPlaylist(playlist, signal) {
  for (const item of playlist) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    await playUrl(item.url, signal);
  }
}

function pickEnglishVoice(voiceProfile = 'narrator') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const en = voices.filter((v) => v.lang?.startsWith('en'));
  const profile = String(voiceProfile || '').toLowerCase();
  const wantFemale = profile.includes('female');
  const wantMale = profile.includes('male') && !wantFemale;
  const wantChild = profile.includes('child');

  const matchName = (re) => en.find((v) => re.test(v.name));

  if (wantFemale) {
    return (
      matchName(/female|zira|samantha|jenny|aria|susan|victoria/i) ||
      en.find((v) => v.name.includes('Female')) ||
      en[0]
    );
  }
  if (wantChild) {
    return matchName(/child|kid|junior/i) || matchName(/female|zira|samantha/i) || en[0];
  }
  if (wantMale) {
    return (
      matchName(/male|david|guy|ryan|mark|james|andrew|brian/i) ||
      en.find((v) => v.name.includes('Male')) ||
      en[0]
    );
  }
  return en.find((v) => v.lang?.startsWith('en')) || voices[0] || null;
}

function readWithBrowserSpeech(text, signal, onState, voiceProfile = 'narrator') {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    throw new Error('Browser speech not available');
  }

  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (!clean) throw new Error('No text to read');

  return new Promise((resolve, reject) => {
    const utter = new SpeechSynthesisUtterance(clean);
    speechUtterance = utter;
    const profile = String(voiceProfile || '').toLowerCase();
    utter.rate = profile.includes('child') ? 1.02 : 0.92;
    utter.pitch = profile.includes('child') ? 1.12 : profile.includes('female') ? 1.05 : 0.98;
    utter.volume = targetVoiceVolume();
    const voice = pickEnglishVoice(voiceProfile);
    if (voice) utter.voice = voice;

    const cleanup = () => {
      utter.onend = null;
      utter.onerror = null;
      if (speechUtterance === utter) speechUtterance = null;
    };

    if (signal?.aborted) {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const onAbort = () => {
      window.speechSynthesis.cancel();
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    utter.onend = () => {
      signal?.removeEventListener('abort', onAbort);
      cleanup();
      resolve();
    };
    utter.onerror = () => {
      signal?.removeEventListener('abort', onAbort);
      cleanup();
      reject(new Error('Browser speech failed'));
    };

    onState?.('playing', 'browser');
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  });
}

function shouldFallbackToBrowser(err) {
  if (!err) return true;
  if (err.name === 'AbortError') return false;
  const msg = String(err.message || err).toLowerCase();
  return (
    err.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('missing tools') ||
    msg.includes('chatterbox') ||
    msg.includes('503') ||
    msg.includes('tts failed') ||
    msg.includes('not found at')
  );
}

function shouldUseBrowserSpeechFallback() {
  return readAudioPrefs().allowBrowserSpeechFallback !== false;
}

function warmChatterboxCache({ caseId, section, text, voiceProfile }) {
  void prefetchCaseAudio({ caseId, section, text, voiceProfile });
}

export async function readCaseAloud({ caseId, section, text, voiceProfile = 'narrator', onState }) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    onState?.('error', 'No text to read');
    return;
  }

  if (
    (readerEl && !readerEl.paused) ||
    (typeof window !== 'undefined' && window.speechSynthesis?.speaking)
  ) {
    stopReader();
    onState?.('idle');
    return;
  }

  stopReader();
  const gen = readerGen;
  onState?.('generating');

  const controller = new AbortController();
  readerAbort = controller;

  try {
    const statusResp = await fetch(
      `${apiUrl('/api/read-case/status')}?${new URLSearchParams({
        caseId: String(caseId || ''),
        section: String(section || 'hpi'),
        text: trimmed.slice(0, 12000),
        voiceProfile: String(voiceProfile || 'narrator'),
      })}`,
      { signal: controller.signal },
    );

    if (statusResp.ok) {
      const status = await statusResp.json();
      if (status.complete && status.playlist?.length) {
        onState?.('playing', 'cached');
        await playPlaylist(status.playlist, controller.signal);
        if (gen === readerGen) onState?.('idle');
        return;
      }
      if (status.ready > 0) {
        onState?.('generating', `${status.ready}/${status.total} cached`);
      }
    }

    if (controller.signal.aborted || gen !== readerGen) return;

    // Chatterbox is not realtime — speak now with Windows/browser voice while cache warms.
    if (shouldUseBrowserSpeechFallback()) {
      warmChatterboxCache({ caseId, section, text: trimmed, voiceProfile });
      onState?.('generating', 'browser');
      await readWithBrowserSpeech(trimmed, controller.signal, onState, voiceProfile);
      if (gen === readerGen) onState?.('idle');
      return;
    }

    const r = await fetch(apiUrl('/api/read-case'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        section,
        text: trimmed.slice(0, 12000),
        voiceProfile: String(voiceProfile || 'narrator'),
      }),
      signal: controller.signal,
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || `TTS failed (${r.status})`);
    }

    const data = await r.json();
    const playlist = data.playlist || [];
    if (!playlist.length) throw new Error('No audio returned');

    onState?.('playing', data.cached ? 'cached' : data.partial ? 'resumed' : 'fresh');
    await playPlaylist(playlist, controller.signal);
    if (gen === readerGen) onState?.('idle');
  } catch (e) {
    if (e.name === 'AbortError') {
      onState?.('idle');
      return;
    }

    if (shouldFallbackToBrowser(e) && shouldUseBrowserSpeechFallback()) {
      warmChatterboxCache({ caseId, section, text: trimmed, voiceProfile });
      try {
        onState?.('generating', 'browser');
        await readWithBrowserSpeech(trimmed, controller.signal, onState, voiceProfile);
        if (gen === readerGen) onState?.('idle');
        return;
      } catch (browserErr) {
        if (browserErr.name === 'AbortError') {
          onState?.('idle');
          return;
        }
      }
    }

    stopReader();
    onState?.('error', String(e.message || e));
  } finally {
    if (readerAbort === controller) readerAbort = null;
  }
}

export function stopCaseReader() {
  stopReader();
}

/** Generate / cache TTS without playing — makes the play button feel instant on repeat. */
export async function prefetchCaseAudio({ caseId, section, text, voiceProfile = 'narrator' }) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return;

  try {
    await fetch(apiUrl('/api/read-case'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        section,
        text: trimmed.slice(0, 12000),
        voiceProfile: String(voiceProfile || 'narrator'),
      }),
    });
  } catch {
    /* best-effort cache warm */
  }
}
