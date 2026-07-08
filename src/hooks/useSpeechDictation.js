import { useCallback, useRef, useState } from 'react';
import { createLiveSpeechRecognition, speechRecognitionSupported } from '../lib/liveSpeechRecognition.js';

/**
 * Append-only speech dictation into a text field (mnemonics, notes).
 */
export function useSpeechDictation({ onText, onError }) {
  const [recording, setRecording] = useState(false);
  const [livePreview, setLivePreview] = useState('');
  const recRef = useRef(null);
  const activeRef = useRef(false);
  const baseRef = useRef('');

  const stop = useCallback(() => {
    activeRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.stop();
    } catch {
      /* ignore */
    }
    setRecording(false);
    setLivePreview('');
  }, []);

  const start = useCallback(() => {
    if (recording) return;
    if (!speechRecognitionSupported()) {
      onError?.(new Error('Speech recognition needs Chrome or Edge'));
      return;
    }
    baseRef.current = '';
    const rec = createLiveSpeechRecognition({
      onFinalChunk: (text) => {
        const chunk = String(text || '').trim();
        if (!chunk) return;
        baseRef.current = `${baseRef.current}${baseRef.current ? ' ' : ''}${chunk}`.trim();
        onText?.(baseRef.current);
        setLivePreview('');
      },
      onInterim: (text) => {
        const interim = String(text || '').trim();
        setLivePreview(
          `${baseRef.current}${baseRef.current && interim ? ' ' : ''}${interim}`.trim(),
        );
      },
      onError: (event) => {
        if (event?.error === 'not-allowed') {
          onError?.(new Error('Microphone permission denied'));
        }
      },
    });
    if (!rec) {
      onError?.(new Error('Speech recognition unavailable'));
      return;
    }
    recRef.current = rec;
    activeRef.current = true;
    rec.onend = () => {
      if (activeRef.current && recRef.current === rec) {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };
    try {
      rec.start();
      setRecording(true);
    } catch (e) {
      recRef.current = null;
      activeRef.current = false;
      onError?.(e instanceof Error ? e : new Error('Could not start microphone'));
    }
  }, [recording, onText, onError]);

  const toggle = useCallback(() => {
    if (recording) stop();
    else start();
  }, [recording, start, stop]);

  const seedBase = useCallback((text) => {
    baseRef.current = String(text || '').trim();
  }, []);

  return {
    recording,
    livePreview,
    toggle,
    stop,
    seedBase,
  };
}
