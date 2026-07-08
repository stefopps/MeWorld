import { useState, useRef, useCallback } from 'react';
import { uploadCaseRecording } from '../lib/caseUserLog.js';
import {
  fetchVoiceNoteStatus,
  mergeVoiceNoteChunk,
  transcribeVoiceNoteAudioChunk,
  transcribeVoiceNoteFull,
} from '../lib/voiceNoteTranscribe.js';
import {
  beginLiveVoiceNote,
  finalizeLiveVoiceNote,
  updateLiveVoiceNote,
} from '../lib/voiceNoteNotes.js';
import { createLiveSpeechRecognition, speechRecognitionSupported } from '../lib/liveSpeechRecognition.js';

const RECORDING_LABEL = 'Recording…';
const TRANSCRIBING_LABEL = 'Transcribing…';

/**
 * Rolling Whisper chunk interval — same as the differential recorder (12 s).
 * Each chunk is sent to Whisper while recording, giving live preview and
 * ensuring audio is never lost if the tab loses focus before stop fires.
 */
const WHISPER_CHUNK_MS = 12_000;

/**
 * Mic capture → rolling Whisper chunks (same engine as differential recorder)
 * → full-clip Whisper on stop → append to case notes → save audio.
 *
 * Fixes:
 *  - Cutoff: rec.start(WHISPER_CHUNK_MS) so ondataavailable fires every 12 s,
 *    not only on stop.
 *  - Engine mismatch: batch mode now uses the same Whisper chunk pipeline as
 *    useDifferentialVoice instead of falling back to browser SpeechRecognition.
 */
export function useCaseRecording({
  caseId,
  sessionId,
  ensureSession,
  onSaved,
  onError,
  onRecordingStart,
  onTranscriptUpdate,
  onNotesChanged,
  onTranscriptReady,
  promptHint = '',
  // Free-form dictation: send the local/Whisper caption verbatim. No LLM
  // "merge" reword pass. Set true only for list-style recorders that want
  // the diagnosis-cleanup pass.
  cleanup = false,
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const sessionIdRef = useRef(sessionId);
  const speechRef = useRef(null);
  const speechActiveRef = useRef(false);
  const transcriptRef = useRef('');
  const mergeQueueRef = useRef(Promise.resolve());
  const whisperQueueRef = useRef(Promise.resolve());
  const liveStampRef = useRef('');
  const interimRef = useRef('');
  const batchModeRef = useRef(false);
  const promptHintRef = useRef(promptHint || '');
  const cleanupRef = useRef(cleanup);
  const onTranscriptReadyRef = useRef(onTranscriptReady);
  onTranscriptReadyRef.current = onTranscriptReady;
  promptHintRef.current = promptHint || '';
  cleanupRef.current = cleanup;
  sessionIdRef.current = sessionId;

  // ─── helpers ──────────────────────────────────────────────────────────────

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const resolveSessionId = useCallback(async () => {
    if (sessionIdRef.current) return sessionIdRef.current;
    if (!ensureSession) return null;
    const sid = await ensureSession();
    if (sid) sessionIdRef.current = sid;
    return sid;
  }, [ensureSession]);

  const pushNotes = useCallback(
    (transcript, interim = '') => {
      if (!caseId) return;
      const display = interim
        ? `${transcript}${transcript ? ' ' : ''}${interim}`.trim()
        : transcript;
      updateLiveVoiceNote(caseId, display);
      onNotesChanged?.();
      setLiveTranscript(display);
      onTranscriptUpdate?.(display, { live: true, interim: Boolean(interim) });
    },
    [caseId, onNotesChanged, onTranscriptUpdate],
  );

  // ─── browser speech merge queue (fallback when Whisper unavailable) ────────

  const enqueueMerge = useCallback(
    (chunkText) => {
      const chunk = String(chunkText || '').trim();
      if (!chunk) return mergeQueueRef.current;

      mergeQueueRef.current = mergeQueueRef.current
        .then(async () => {
          if (batchModeRef.current || !cleanupRef.current) {
            const fastAppend = `${transcriptRef.current}${transcriptRef.current ? ' ' : ''}${chunk}`.trim();
            transcriptRef.current = fastAppend;
            interimRef.current = '';
            pushNotes(fastAppend);
            return;
          }
          setTranscribing(true);
          try {
            const merged = await mergeVoiceNoteChunk(transcriptRef.current, chunk);
            transcriptRef.current = merged;
            interimRef.current = '';
            pushNotes(merged);
          } catch {
            const fallback = `${transcriptRef.current}${transcriptRef.current ? ' ' : ''}${chunk}`.trim();
            transcriptRef.current = fallback;
            interimRef.current = '';
            pushNotes(fallback);
          } finally {
            setTranscribing(false);
          }
        })
        .catch(() => {});

      return mergeQueueRef.current;
    },
    [pushNotes],
  );

  // ─── rolling Whisper chunk queue (batch mode — same as differential recorder) ──

  const enqueueWhisperChunk = useCallback(
    (blob) => {
      if (!blob?.size || blob.size < 800) return whisperQueueRef.current;

      whisperQueueRef.current = whisperQueueRef.current
        .then(async () => {
          setTranscribing(true);
          try {
            const merged = await transcribeVoiceNoteAudioChunk(
              blob,
              transcriptRef.current,
              promptHintRef.current,
              { cleanup: cleanupRef.current },
            );
            if (merged) {
              transcriptRef.current = merged;
              interimRef.current = '';
              pushNotes(merged);
            }
          } catch {
            /* chunk failures are non-fatal — full clip runs on stop */
          } finally {
            setTranscribing(false);
          }
        })
        .catch(() => {});

      return whisperQueueRef.current;
    },
    [pushNotes],
  );

  // ─── browser SpeechRecognition (fallback only) ────────────────────────────

  const stopSpeechRecognition = useCallback(() => {
    speechActiveRef.current = false;
    const rec = speechRef.current;
    speechRef.current = null;
    try { rec?.stop(); } catch { /* ignore */ }
  }, []);

  const startSpeechRecognition = useCallback(() => {
    if (!speechRecognitionSupported()) return false;
    const rec = createLiveSpeechRecognition({
      onFinalChunk: (text) => { void enqueueMerge(text); },
      onInterim: (text) => {
        interimRef.current = text;
        pushNotes(transcriptRef.current, text);
      },
      onError: (event) => {
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          onError?.(new Error('Microphone permission denied for speech recognition'));
        }
      },
    });
    if (!rec) return false;

    speechRef.current = rec;
    speechActiveRef.current = true;
    rec.onend = () => {
      if (speechActiveRef.current && speechRef.current === rec) {
        try { rec.start(); } catch { /* ignore restart errors */ }
      }
    };
    try {
      rec.start();
      return true;
    } catch {
      speechRef.current = null;
      speechActiveRef.current = false;
      return false;
    }
  }, [enqueueMerge, onError, pushNotes]);

  // ─── full-clip Whisper on stop ────────────────────────────────────────────

  const transcribeBatchClip = useCallback(
    async (blob) => {
      if (!blob?.size) return '';
      setTranscribing(true);
      pushNotes(TRANSCRIBING_LABEL);
      try {
        const result = await transcribeVoiceNoteFull(blob, {
          promptHint: promptHintRef.current,
          cleanup: cleanupRef.current,
        });
        const text = result.transcript || result.raw || '';
        if (text) {
          transcriptRef.current = text;
          interimRef.current = '';
          pushNotes(text);
        }
        return text;
      } catch (e) {
        onError?.(e instanceof Error ? e : new Error('Could not transcribe voice note'));
        return '';
      } finally {
        setTranscribing(false);
      }
    },
    [onError, pushNotes],
  );

  // ─── stop / start ─────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') return;
    rec.stop();
    setRecording(false);
    stopSpeechRecognition();
  }, [stopSpeechRecognition]);

  const startRecording = useCallback(async () => {
    if (recording || busy) return;

    const sid = await resolveSessionId();
    if (!sid) {
      onError?.(new Error('Could not start case session — is the API server running?'));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.(new Error('Microphone not supported in this browser'));
      return;
    }

    const status = await fetchVoiceNoteStatus();
    batchModeRef.current = Boolean(status.batch);
    const speechAvailable = speechRecognitionSupported();
    if (!batchModeRef.current && !speechAvailable) {
      onError?.(
        new Error(
          'Transcription unavailable — start API server with OPENAI_API_KEY or install faster-whisper',
        ),
      );
      return;
    }

    try {
      transcriptRef.current = '';
      interimRef.current = '';
      setLiveTranscript('');
      mergeQueueRef.current = Promise.resolve();
      whisperQueueRef.current = Promise.resolve();
      liveStampRef.current = caseId ? beginLiveVoiceNote(caseId) : '';
      onNotesChanged?.();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      if (batchModeRef.current) {
        pushNotes(RECORDING_LABEL);
      }
      const speechStarted = startSpeechRecognition();
      if (!batchModeRef.current && !speechStarted) {
        stopTracks();
        onError?.(new Error('Speech recognition unavailable in this browser — use Chrome or enable Whisper on the API server'));
        return;
      }

      rec.ondataavailable = (event) => {
        if (!event.data?.size) return;
        chunksRef.current.push(event.data);
        // Rolling Whisper chunk — same as differential recorder.
        // Each 12-second slice is sent to Whisper immediately so the user
        // gets a live preview and audio is never lost on an abrupt stop.
        if (batchModeRef.current && event.data.size > 800) {
          void enqueueWhisperChunk(event.data);
        }
      };

      rec.onstop = async () => {
        stopTracks();
        stopSpeechRecognition();
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || 'audio/webm',
        });
        const durationMs = Math.max(0, Date.now() - startedAtRef.current);
        const uploadSessionId = sessionIdRef.current || sid;
        setBusy(true);
        try {
          if (batchModeRef.current && blob.size > 0) {
            // Wait for in-flight chunk Whisper calls to finish.
            // The live chunk-by-chunk transcription is typically more
            // accurate (focused 12s windows) than full-file re-transcription.
            // Only fall back to full-clip Whisper if the live transcript is empty.
            await whisperQueueRef.current;
            const liveText = (transcriptRef.current || '').trim();
            if (!liveText) {
              await transcribeBatchClip(blob);
            }
            // If live already has text, skip the full-file re-pass — it
            // often produces worse results (see docs/voice-transcription-bug.md).
          } else {
            await mergeQueueRef.current;
          }

          const finalTranscript = transcriptRef.current.trim();
          if (!finalTranscript) {
            onError?.(
              new Error('No speech captured — check mic permissions or STT setup on the API server'),
            );
          }
          const saved = await uploadCaseRecording(caseId, uploadSessionId, blob, durationMs);
          if (caseId) {
            finalizeLiveVoiceNote(caseId, finalTranscript, {
              slot: saved?.slot,
              stamp: liveStampRef.current || new Date().toLocaleTimeString(),
            });
            onNotesChanged?.();
          }
          if (saved) onSaved?.(saved);
          else onError?.(new Error('Could not save recording'));
          if (finalTranscript) {
            onTranscriptReadyRef.current?.(finalTranscript);
          }
        } catch (e) {
          onError?.(e);
        } finally {
          setBusy(false);
          recorderRef.current = null;
        }
      };

      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      // Use a timeslice so ondataavailable fires every WHISPER_CHUNK_MS.
      // This prevents cutoffs and enables rolling Whisper preview.
      rec.start(WHISPER_CHUNK_MS);
      setRecording(true);
      onRecordingStart?.();
    } catch (e) {
      stopTracks();
      stopSpeechRecognition();
      onError?.(e);
    }
  }, [
    busy,
    caseId,
    enqueueWhisperChunk,
    onError,
    onNotesChanged,
    onRecordingStart,
    onSaved,
    pushNotes,
    recording,
    resolveSessionId,
    startSpeechRecognition,
    stopSpeechRecognition,
    stopTracks,
    transcribeBatchClip,
  ]);

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording();
    else void startRecording();
  }, [recording, startRecording, stopRecording]);

  return {
    recording,
    busy,
    transcribing,
    liveTranscript,
    toggleRecording,
    startRecording,
    stopRecording,
    transcript: transcriptRef.current,
  };
}
