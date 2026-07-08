import { useCallback, useRef, useState } from 'react';
import { startPlaySession, uploadCaseRecording } from '../lib/caseUserLog.js';
import { createLiveSpeechRecognition, speechRecognitionSupported } from '../lib/liveSpeechRecognition.js';
import {
  fetchVoiceNoteStatus,
  mergeVoiceNoteChunk,
  transcribeVoiceNoteAudioChunk,
  transcribeVoiceNoteFull,
} from '../lib/voiceNoteTranscribe.js';
import { saveLocalDifferentialRecording } from '../lib/differentialVoiceStorage.js';
import { parseDiagnosisList } from '../lib/differentialGuessParse.js';
import { parseDifferentialTranscript } from '../lib/differentialTranscriptParse.js';
import {
  STACKER_FIRST_PARSE_SECONDS,
  STACKER_INCREMENTAL_SECONDS,
} from '../lib/differentialStackerPrefs.js';

const RECORDING_LABEL = 'Recording…';
const TRANSCRIBING_LABEL = 'Transcribing…';

const INCREMENTAL_MS = STACKER_INCREMENTAL_SECONDS * 1000;
const FIRST_PARSE_MS = STACKER_FIRST_PARSE_SECONDS * 1000;
/** Rolling Whisper slices while recording — preview only; full clip on stop is authoritative. */
const WHISPER_CHUNK_MS = 12_000;
/** Stacker smart-review must not block on first local Whisper model load. */
const STACKER_STOP_WAIT_MS = 25_000;

export function speechTextToDiagnoses(text) {
  return parseDiagnosisList(text);
}

export function useDifferentialVoice({
  caseId,
  topic,
  onDiagnosesHeard,
  onSaved,
  onError,
  deferLiveDiagnoses = false,
  incrementalParse = false,
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [incrementalParsing, setIncrementalParsing] = useState(false);
  const [livePreview, setLivePreview] = useState('');
  const [cleanedPreview, setCleanedPreview] = useState('');
  const [recordingCaseId, setRecordingCaseId] = useState(null);
  const [mediaStream, setMediaStream] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const sessionIdRef = useRef(null);
  const speechRef = useRef(null);
  const speechActiveRef = useRef(false);
  const transcriptRef = useRef('');
  const livePreviewRef = useRef('');
  const recordingCaseIdRef = useRef(caseId);
  const mergeQueueRef = useRef(Promise.resolve());
  const whisperQueueRef = useRef(Promise.resolve());
  const incrementalQueueRef = useRef(Promise.resolve());
  const incrementalResultRef = useRef(null);
  const incrementalIntervalRef = useRef(null);
  const firstParseTimerRef = useRef(null);
  const batchModeRef = useRef(false);
  const stopWaitRef = useRef(null);
  const skipSlowStopRef = useRef(false);
  const fullAudioParsedRef = useRef(false);
  const promptHintRef = useRef(topic || '');
  const deferLiveRef = useRef(deferLiveDiagnoses);
  const incrementalParseRef = useRef(incrementalParse);
  const voiceEpochRef = useRef(0);

  deferLiveRef.current = deferLiveDiagnoses;
  incrementalParseRef.current = incrementalParse;
  promptHintRef.current = topic || '';

  const isStaleVoice = useCallback((epoch, forCaseId) => {
    if (epoch !== voiceEpochRef.current) return true;
    if (forCaseId != null && recordingCaseIdRef.current !== forCaseId) return true;
    return false;
  }, []);

  const clearIncrementalTimers = useCallback(() => {
    if (incrementalIntervalRef.current) {
      window.clearInterval(incrementalIntervalRef.current);
      incrementalIntervalRef.current = null;
    }
    if (firstParseTimerRef.current) {
      window.clearTimeout(firstParseTimerRef.current);
      firstParseTimerRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setMediaStream(null);
  }, []);

  const ensureSession = useCallback(async (forCaseId) => {
    const cid = forCaseId ?? caseId;
    if (!cid) return null;
    try {
      const sid = await startPlaySession(cid, { mode: 'differential-practice' });
      if (sid) sessionIdRef.current = sid;
      return sid;
    } catch {
      return null;
    }
  }, [caseId]);

  const setPreview = useCallback((text) => {
    livePreviewRef.current = text;
    setLivePreview(text);
  }, []);

  const applyTranscript = useCallback(
    (text, epoch, forCaseId) => {
      if (isStaleVoice(epoch, forCaseId)) return;
      const merged = String(text || '').trim();
      transcriptRef.current = merged;
      setPreview(merged);
      if (!deferLiveRef.current) {
        const parts = speechTextToDiagnoses(merged);
        if (parts.length) onDiagnosesHeard?.(parts);
      }
    },
    [isStaleVoice, onDiagnosesHeard, setPreview],
  );

  const commitLivePreview = useCallback(() => {
    const preview = livePreviewRef.current.trim();
    const committed = transcriptRef.current.trim();
    if (
      preview.length > committed.length &&
      preview !== RECORDING_LABEL &&
      preview !== TRANSCRIBING_LABEL
    ) {
      transcriptRef.current = preview;
      setPreview(preview);
    }
    return transcriptRef.current.trim();
  }, [setPreview]);

  const enqueueMerge = useCallback(
    (chunkText) => {
      const chunk = String(chunkText || '').trim();
      if (!chunk) return mergeQueueRef.current;

      const epoch = voiceEpochRef.current;
      const forCaseId = recordingCaseIdRef.current;
      const fastAppend = `${transcriptRef.current}${transcriptRef.current ? ' ' : ''}${chunk}`.trim();
      mergeQueueRef.current = mergeQueueRef.current
        .then(async () => {
          if (isStaleVoice(epoch, forCaseId)) return;
          if (incrementalParseRef.current) {
            applyTranscript(fastAppend, epoch, forCaseId);
            return;
          }
          setTranscribing(true);
          try {
            const merged = await mergeVoiceNoteChunk(transcriptRef.current, chunk);
            applyTranscript(merged, epoch, forCaseId);
          } catch {
            applyTranscript(fastAppend, epoch, forCaseId);
          } finally {
            if (!isStaleVoice(epoch, forCaseId)) setTranscribing(false);
          }
        })
        .catch(() => {});

      return mergeQueueRef.current;
    },
    [applyTranscript, isStaleVoice],
  );

  const resetVoiceState = useCallback(() => {
    voiceEpochRef.current += 1;
    clearIncrementalTimers();
    incrementalQueueRef.current = Promise.resolve();
    mergeQueueRef.current = Promise.resolve();
    whisperQueueRef.current = Promise.resolve();
    incrementalResultRef.current = null;
    fullAudioParsedRef.current = false;
    transcriptRef.current = '';
    livePreviewRef.current = '';
    setLivePreview('');
    setCleanedPreview('');
    setIncrementalParsing(false);
    setFinalizing(false);
    setTranscribing(false);
    recordingCaseIdRef.current = null;
    setRecordingCaseId(null);
    setMediaStream(null);
  }, [clearIncrementalTimers]);

  const runIncrementalParse = useCallback(
    ({ final = false, force = false, previewOnly = false, fromFullAudio = false } = {}) => {
      if (!incrementalParseRef.current) return incrementalQueueRef.current;

      const epoch = voiceEpochRef.current;
      const parseCaseId = recordingCaseIdRef.current ?? caseId;
      incrementalQueueRef.current = incrementalQueueRef.current
        .then(async () => {
          if (isStaleVoice(epoch, parseCaseId)) return;
          await mergeQueueRef.current;
          await whisperQueueRef.current;
          if (isStaleVoice(epoch, parseCaseId)) return;
          const raw = commitLivePreview();
          if (!raw || raw.length < 3 || raw === RECORDING_LABEL || raw === TRANSCRIBING_LABEL) return;

          const cached = incrementalResultRef.current;
          if (!previewOnly && !force && cached?.raw === raw && Boolean(cached.isFinal) === final) return;
          if (!previewOnly && !force && !final && cached?.raw === raw) return;

          setIncrementalParsing(true);
          if (final && !previewOnly) setFinalizing(true);
          try {
            const result = await parseDifferentialTranscript({
              rawTranscript: raw,
              topic,
              caseId: parseCaseId,
              final: previewOnly ? false : final,
            });
            if (isStaleVoice(epoch, parseCaseId)) return;
            setCleanedPreview(result.cleanedTranscript || raw);
            if (previewOnly) return;
            const diagnoses = result.diagnoses?.length
              ? result.diagnoses
              : speechTextToDiagnoses(raw);
            incrementalResultRef.current = {
              raw,
              cleanedTranscript: result.cleanedTranscript || raw,
              diagnoses,
              provider: result.provider || null,
              isFinal: final,
              fromFullAudio: fromFullAudio || Boolean(cached?.fromFullAudio),
            };
            if (fromFullAudio && final) fullAudioParsedRef.current = true;
          } catch (e) {
            if (!isStaleVoice(epoch, parseCaseId)) {
              onError?.(e instanceof Error ? e : new Error('Could not parse transcript chunk'));
            }
          } finally {
            if (!isStaleVoice(epoch, parseCaseId)) {
              setIncrementalParsing(false);
              if (final && !previewOnly) setFinalizing(false);
            }
          }
        })
        .catch(() => {});

      return incrementalQueueRef.current;
    },
    [caseId, topic, onError, commitLivePreview, isStaleVoice],
  );

  const enqueueWhisperChunk = useCallback(
    (blob, epoch, forCaseId) => {
      if (!blob?.size || blob.size < 800) return whisperQueueRef.current;

      whisperQueueRef.current = whisperQueueRef.current
        .then(async () => {
          if (isStaleVoice(epoch, forCaseId)) return;
          setTranscribing(true);
          try {
            const merged = await transcribeVoiceNoteAudioChunk(
              blob,
              transcriptRef.current,
              promptHintRef.current,
            );
            if (isStaleVoice(epoch, forCaseId)) return;
            if (merged) {
              // Preview only — full clip Whisper on stop is authoritative for scoring.
              applyTranscript(merged, epoch, forCaseId);
              if (incrementalParseRef.current) {
                await runIncrementalParse({ previewOnly: true });
              }
            }
          } catch {
            /* chunk failures are non-fatal — full clip runs when the case ends */
          } finally {
            if (!isStaleVoice(epoch, forCaseId)) setTranscribing(false);
          }
        })
        .catch(() => {});

      return whisperQueueRef.current;
    },
    [applyTranscript, isStaleVoice, runIncrementalParse],
  );

  const triggerPrefinalParse = useCallback(() => {
    if (batchModeRef.current) {
      const raw = commitLivePreview();
      const hasText =
        raw &&
        raw.length >= 3 &&
        raw !== RECORDING_LABEL &&
        raw !== TRANSCRIBING_LABEL;
      if (hasText) {
        return runIncrementalParse({ final: true, force: true });
      }
      return runIncrementalParse({ previewOnly: true, force: true });
    }
    return runIncrementalParse({ final: true, force: true });
  }, [runIncrementalParse, commitLivePreview]);

  const startIncrementalParsing = useCallback(() => {
    clearIncrementalTimers();
    incrementalResultRef.current = null;
    fullAudioParsedRef.current = false;
    setCleanedPreview('');
    incrementalQueueRef.current = Promise.resolve();
    if (!incrementalParseRef.current) return;

    firstParseTimerRef.current = window.setTimeout(() => {
      void runIncrementalParse({
        final: false,
        previewOnly: batchModeRef.current,
      });
    }, FIRST_PARSE_MS);

    incrementalIntervalRef.current = window.setInterval(() => {
      void runIncrementalParse({
        final: false,
        previewOnly: batchModeRef.current,
      });
    }, INCREMENTAL_MS);
  }, [clearIncrementalTimers, runIncrementalParse]);

  const applyParseResult = useCallback(
    (result, raw, epoch, forCaseId) => {
      if (isStaleVoice(epoch, forCaseId)) {
        return { cleanedTranscript: raw, diagnoses: [], provider: null };
      }
      const cleaned = result.cleanedTranscript || raw;
      const diagnoses = result.diagnoses?.length ? result.diagnoses : speechTextToDiagnoses(raw);
      if (cleaned) {
        transcriptRef.current = cleaned;
        setPreview(cleaned);
        setCleanedPreview(cleaned);
      }
      if (diagnoses.length) onDiagnosesHeard?.(diagnoses);
      return {
        cleanedTranscript: cleaned,
        diagnoses,
        provider: result.provider || null,
      };
    },
    [isStaleVoice, onDiagnosesHeard, setPreview],
  );

  const finalizeTranscript = useCallback(async () => {
    const epoch = voiceEpochRef.current;
    const forCaseId = recordingCaseIdRef.current ?? caseId;
    clearIncrementalTimers();
    setTranscribing(true);
    try {
      await mergeQueueRef.current;
      await whisperQueueRef.current;
      await incrementalQueueRef.current;
    } finally {
      if (!isStaleVoice(epoch, forCaseId)) setTranscribing(false);
    }

    if (isStaleVoice(epoch, forCaseId)) {
      return { cleanedTranscript: '', diagnoses: [] };
    }

    const raw = commitLivePreview();
    if (!raw || raw === RECORDING_LABEL || raw === TRANSCRIBING_LABEL) {
      return { cleanedTranscript: '', diagnoses: [] };
    }

    const cached = incrementalResultRef.current;
    if (cached?.isFinal && cached.raw === raw && cached.diagnoses?.length) {
      return applyParseResult(cached, raw, epoch, forCaseId);
    }
    if (cached?.isFinal && cached.raw === raw && cached.cleanedTranscript) {
      return applyParseResult(cached, raw, epoch, forCaseId);
    }

    setFinalizing(true);
    setTranscribing(true);
    try {
      const result = await parseDifferentialTranscript({
        rawTranscript: raw,
        topic,
        caseId: forCaseId,
        final: true,
      });
      if (isStaleVoice(epoch, forCaseId)) {
        return { cleanedTranscript: raw, diagnoses: [], provider: null };
      }
      return applyParseResult(result, raw, epoch, forCaseId);
    } catch (e) {
      if (isStaleVoice(epoch, forCaseId)) {
        return { cleanedTranscript: raw, diagnoses: [], provider: null };
      }
      const fallback = speechTextToDiagnoses(raw);
      if (fallback.length) onDiagnosesHeard?.(fallback);
      onError?.(e instanceof Error ? e : new Error('Could not finalize transcript'));
      return { cleanedTranscript: raw, diagnoses: fallback, provider: null };
    } finally {
      if (!isStaleVoice(epoch, forCaseId)) {
        setFinalizing(false);
        setTranscribing(false);
      }
    }
  }, [
    caseId,
    topic,
    onDiagnosesHeard,
    onError,
    commitLivePreview,
    clearIncrementalTimers,
    applyParseResult,
    isStaleVoice,
  ]);

  const stopSpeechRecognition = useCallback(() => {
    speechActiveRef.current = false;
    const rec = speechRef.current;
    speechRef.current = null;
    try {
      rec?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const startSpeechRecognition = useCallback(() => {
    if (batchModeRef.current || !speechRecognitionSupported()) return false;
    const rec = createLiveSpeechRecognition({
      onFinalChunk: (text) => {
        void enqueueMerge(text);
      },
      onInterim: (text) => {
        setPreview(
          `${transcriptRef.current}${transcriptRef.current ? ' ' : ''}${text}`.trim(),
        );
      },
      onError: (event) => {
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          onError?.(new Error('Microphone permission denied'));
        }
      },
    });
    if (!rec) return false;

    speechRef.current = rec;
    speechActiveRef.current = true;
    rec.onend = () => {
      if (speechActiveRef.current && speechRef.current === rec) {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
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
  }, [enqueueMerge, onError, setPreview]);

  const transcribeBatchClip = useCallback(
    async (blob, epoch, forCaseId) => {
      if (!blob?.size) return '';
      setTranscribing(true);
      setPreview(TRANSCRIBING_LABEL);
      try {
        const result = await transcribeVoiceNoteFull(blob, {
          promptHint: promptHintRef.current,
        });
        if (isStaleVoice(epoch, forCaseId)) return '';
        const text = result.transcript || result.raw || '';
        if (text) {
          incrementalResultRef.current = null;
          fullAudioParsedRef.current = false;
          applyTranscript(text, epoch, forCaseId);
          if (incrementalParseRef.current) {
            await runIncrementalParse({ final: true, force: true, fromFullAudio: true });
          }
        }
        return text;
      } catch (e) {
        if (!isStaleVoice(epoch, forCaseId)) {
          onError?.(e instanceof Error ? e : new Error('Could not transcribe recording'));
        }
        return '';
      } finally {
        if (!isStaleVoice(epoch, forCaseId)) setTranscribing(false);
      }
    },
    [applyTranscript, isStaleVoice, onError, runIncrementalParse, setPreview],
  );

  const stopRecording = useCallback(() => {
    clearIncrementalTimers();
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') return Promise.resolve();
    rec.stop();
    setRecording(false);
    stopSpeechRecognition();
    return Promise.resolve();
  }, [clearIncrementalTimers, stopSpeechRecognition]);

  const finishStopWait = useCallback(() => {
    const waiter = stopWaitRef.current;
    stopWaitRef.current = null;
    if (!waiter) return Promise.resolve();
    return Promise.all([mergeQueueRef.current, whisperQueueRef.current, incrementalQueueRef.current])
      .then(() => waiter())
      .catch(() => waiter());
  }, []);

  /** Stop mic and wait until upload / Whisper / parse queues finish. */
  const stopRecordingAsync = useCallback(
    (timeoutMs = incrementalParseRef.current ? STACKER_STOP_WAIT_MS : 0) => {
      skipSlowStopRef.current = false;
      const rec = recorderRef.current;
      if (!rec || rec.state === 'inactive') {
        return Promise.all([mergeQueueRef.current, whisperQueueRef.current, incrementalQueueRef.current]);
      }
      return new Promise((resolve) => {
        stopWaitRef.current = resolve;
        stopRecording();
        if (timeoutMs > 0) {
          window.setTimeout(() => {
            if (!stopWaitRef.current) return;
            skipSlowStopRef.current = true;
            setBusy(false);
            setTranscribing(false);
            void finishStopWait().then(resolve);
          }, timeoutMs);
        }
      });
    },
    [stopRecording, finishStopWait],
  );

  const startRecording = useCallback(async () => {
    if (recording || busy) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.(new Error('Microphone not supported'));
      return;
    }

    const status = await fetchVoiceNoteStatus();
    // Stacker: live browser speech + incremental DeepSeek parse — avoid blocking on full Whisper on stop.
    const preferLiveSpeech =
      incrementalParseRef.current && speechRecognitionSupported();
    batchModeRef.current = preferLiveSpeech ? false : Boolean(status.batch);
    if (!batchModeRef.current && !speechRecognitionSupported()) {
      onError?.(
        new Error('Speech recognition unavailable — start API server with OPENAI_API_KEY or install faster-whisper'),
      );
      return;
    }

    recordingCaseIdRef.current = caseId;
    setRecordingCaseId(caseId);
    transcriptRef.current = '';
    livePreviewRef.current = '';
    setLivePreview('');
    setCleanedPreview('');
    mergeQueueRef.current = Promise.resolve();
    whisperQueueRef.current = Promise.resolve();
    fullAudioParsedRef.current = false;
    startIncrementalParsing();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMediaStream(stream);
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      const speechStarted = batchModeRef.current ? false : startSpeechRecognition();
      const saveCaseId = recordingCaseIdRef.current;
      const epoch = voiceEpochRef.current;

      if (batchModeRef.current) {
        setPreview(RECORDING_LABEL);
      }

      rec.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
        if (batchModeRef.current && event.data?.size > 800) {
          void enqueueWhisperChunk(event.data, epoch, saveCaseId);
        }
      };

      rec.onstop = async () => {
        stopTracks();
        stopSpeechRecognition();
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const durationMs = Math.max(0, Date.now() - startedAtRef.current);
        const fastStop = skipSlowStopRef.current;
        setBusy(true);
        try {
          if (!fastStop) {
            if (batchModeRef.current && blob.size > 0) {
              await whisperQueueRef.current;
              await transcribeBatchClip(blob, epoch, saveCaseId);
            } else {
              await mergeQueueRef.current;
            }
          }

          let saved = null;
          if (blob.size > 0 && !fastStop) {
            saved = await saveLocalDifferentialRecording(saveCaseId, blob, {
              durationMs,
              transcript: transcriptRef.current,
            });
            const sid = (await ensureSession(saveCaseId)) || sessionIdRef.current;
            if (sid) {
              const uploadLater = incrementalParseRef.current;
              const uploadPromise = uploadCaseRecording(saveCaseId, sid, blob, durationMs);
              if (uploadLater) {
                void uploadPromise
                  .then((remote) => {
                    if (remote) {
                      onSaved?.({
                        ...saved,
                        ...remote,
                        local: true,
                        localId: saved?.localId || saved?.id,
                        transcript: transcriptRef.current,
                      });
                    }
                  })
                  .catch(() => {});
              } else {
                try {
                  const remote = await uploadPromise;
                  if (remote) {
                    saved = { ...saved, ...remote, local: true, localId: saved.localId || saved.id };
                  }
                } catch {
                  /* local copy is enough */
                }
              }
            }
          }
          if (saved) onSaved?.({ ...saved, transcript: transcriptRef.current });
          else if (blob.size > 0 && !speechStarted && !batchModeRef.current && !fastStop) {
            onError?.(new Error('Could not save recording'));
          }
        } catch (e) {
          onError?.(e instanceof Error ? e : new Error('Recording failed'));
        } finally {
          setBusy(false);
          recorderRef.current = null;
          void finishStopWait();
        }
      };

      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      void ensureSession(saveCaseId);
      rec.start(batchModeRef.current ? WHISPER_CHUNK_MS : undefined);
      setRecording(true);
    } catch (e) {
      clearIncrementalTimers();
      stopTracks();
      stopSpeechRecognition();
      onError?.(e instanceof Error ? e : new Error('Could not start microphone'));
    }
  }, [
    busy,
    caseId,
    clearIncrementalTimers,
    ensureSession,
    onError,
    onSaved,
    recording,
    startIncrementalParsing,
    startSpeechRecognition,
    stopSpeechRecognition,
    stopTracks,
    transcribeBatchClip,
    enqueueWhisperChunk,
    finishStopWait,
    setPreview,
  ]);

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording();
    else void startRecording();
  }, [recording, startRecording, stopRecording]);

  return {
    recording,
    busy,
    transcribing,
    finalizing,
    incrementalParsing,
    livePreview,
    cleanedPreview,
    disabled: busy,
    toggleRecording,
    stopRecording,
    stopRecordingAsync,
    startRecording,
    finalizeTranscript,
    triggerPrefinalParse,
    resetVoiceState,
    recordingCaseId,
    mediaStream,
  };
}
