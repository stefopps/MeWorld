import { apiUrl } from './apiBase.js';

async function apiJson(path, options = {}) {
  const r = await fetch(apiUrl(path), {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result || '';
      const base64 = String(dataUrl).split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read audio blob'));
    reader.readAsDataURL(blob);
  });
}

export async function mergeVoiceNoteChunk(priorTranscript, chunkText) {
  const data = await apiJson('/api/voice-note/merge', {
    method: 'POST',
    body: JSON.stringify({ priorTranscript, chunkText }),
  });
  return data.transcript || '';
}

export async function fetchVoiceNoteStatus() {
  try {
    const data = await apiJson('/api/voice-note/status');
    return {
      merge: Boolean(data.merge),
      whisper: Boolean(data.whisper),
      batch: Boolean(data.batch),
      mode: data.mode || 'browser',
      local: Boolean(data.local),
      openai: Boolean(data.openai),
      model: data.model || null,
    };
  } catch {
    return { merge: false, whisper: false, batch: false, mode: 'browser', local: false, openai: false, model: null };
  }
}

export async function transcribeVoiceNoteAudioChunk(
  blob,
  priorTranscript = '',
  promptHint = '',
  { cleanup = true } = {},
) {
  const audioBase64 = await blobToBase64(blob);
  const data = await apiJson('/api/voice-note/transcribe-chunk', {
    method: 'POST',
    body: JSON.stringify({
      audioBase64,
      mimeType: blob.type || 'audio/webm',
      priorTranscript,
      promptHint,
      cleanup,
    }),
  });
  return data.transcript || '';
}

/**
 * Cursor-style batch STT — transcribe a full recorded clip after mic stop.
 * Pass `cleanup: false` to send the verbatim local/Whisper text with no LLM reword.
 */
export async function transcribeVoiceNoteFull(blob, { promptHint = '', cleanup = true } = {}) {
  const audioBase64 = await blobToBase64(blob);
  const data = await apiJson('/api/voice-note/transcribe-full', {
    method: 'POST',
    body: JSON.stringify({
      audioBase64,
      mimeType: blob.type || 'audio/webm',
      promptHint,
      cleanup,
    }),
  });
  return {
    transcript: data.transcript || '',
    raw: data.raw || data.transcript || '',
    provider: data.provider || null,
    model: data.model || null,
  };
}
