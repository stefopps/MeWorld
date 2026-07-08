/** Browser SpeechRecognition wrapper for live voice-note chunks. */
export function createLiveSpeechRecognition({ onFinalChunk, onInterim, onError }) {
  if (typeof window === 'undefined') return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';

  rec.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result[0]?.transcript || '';
      if (result.isFinal) {
        const trimmed = text.trim();
        if (trimmed) onFinalChunk?.(trimmed);
      } else {
        interim += text;
      }
    }
    const preview = interim.trim();
    if (preview) onInterim?.(preview);
  };

  rec.onerror = (event) => {
    onError?.(event);
  };

  return rec;
}

export function speechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}
