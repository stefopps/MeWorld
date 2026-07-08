import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = path.join(__dirname, '..');
const WHISPER_SCRIPT = path.join(GAME_ROOT, 'tools', 'whisper', 'transcribe.py');

function deepseekKey() { return process.env.DEEPSEEK_API_KEY || ''; }
function openaiKey() { return process.env.OPENAI_API_KEY || ''; }
function whisperMode() { return String(process.env.WHISPER_MODE || 'auto').toLowerCase(); }
function whisperModel() { return process.env.WHISPER_MODEL || 'small.en'; }
function whisperPython() {
  return (
    process.env.WHISPER_PYTHON ||
    process.env.CHATTERBOX_PYTHON ||
    (process.platform === 'win32' ? 'python' : 'python3')
  );
}
function deepseekModel() { return process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat'; }
function openaiModel() { return process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'; }

let localWhisperReady = null;

function chatProvider() {
  if (deepseekKey()) return 'deepseek';
  if (openaiKey()) return 'openai';
  return null;
}

function chatModel() {
  return chatProvider() === 'deepseek' ? deepseekModel() : openaiModel();
}

function chatApiKey() {
  return deepseekKey() || openaiKey() || null;
}

async function callChatCompletion(key, messages, { maxTokens = 900, temperature = 0.2 } = {}) {
  const provider = chatProvider();
  if (!provider) throw new Error('Add DEEPSEEK_API_KEY or OPENAI_API_KEY for transcription merge');
  const endpoint =
    provider === 'deepseek'
      ? 'https://api.deepseek.com/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

  const r = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: chatModel(),
      max_tokens: maxTokens,
      temperature,
      messages,
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(err || `${provider} error ${r.status}`);
  }
  const data = await r.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function whisperScriptExists() {
  return fs.existsSync(WHISPER_SCRIPT);
}

function runPythonCheck(args) {
  return new Promise((resolve) => {
    const child = spawn(whisperPython(), args, {
      windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr.on('data', (d) => {
      stderr += String(d);
    });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0 && /ok/i.test(stdout.trim())));
  });
}

let probePromise = null;

export async function probeLocalWhisper() {
  if (localWhisperReady != null) return localWhisperReady;
  if (probePromise) return probePromise;
  if (!whisperScriptExists()) {
    localWhisperReady = false;
    return false;
  }
  probePromise = runPythonCheck(['-c', 'import faster_whisper; print("ok")']);
  const ok = await probePromise;
  localWhisperReady = ok;
  return ok;
}

export function voiceNoteMergeAvailable() {
  return Boolean(chatApiKey());
}

export function voiceNoteWhisperAvailable() {
  return Boolean(openaiKey());
}

export async function voiceNoteBatchAvailable() {
  if (whisperMode() === 'openai') return voiceNoteWhisperAvailable();
  if (whisperMode() === 'local') return probeLocalWhisper();
  return (await probeLocalWhisper()) || voiceNoteWhisperAvailable();
}

export async function voiceNoteStatus() {
  const local = await probeLocalWhisper();
  const openai = voiceNoteWhisperAvailable();
  let mode = 'browser';
  if (whisperMode() === 'local' && local) mode = 'local';
  else if (whisperMode() === 'openai' && openai) mode = 'openai';
  else if (whisperMode() === 'auto') {
    if (local) mode = 'local';
    else if (openai) mode = 'openai';
  }
  return {
    merge: voiceNoteMergeAvailable(),
    whisper: openai,
    batch: mode !== 'browser',
    mode,
    local,
    openai,
    model: whisperModel(),
    python: whisperPython(),
    script: whisperScriptExists() ? WHISPER_SCRIPT : null,
  };
}

export async function mergeVoiceNoteTranscript(priorTranscript, chunkText) {
  const key = chatApiKey();
  if (!key) throw new Error('Add DEEPSEEK_API_KEY or OPENAI_API_KEY for voice note transcription');
  const prior = String(priorTranscript || '').trim();
  const chunk = String(chunkText || '').trim();
  if (!chunk) return prior;

  const merged = await callChatCompletion(key, [
    {
      role: 'system',
      content: `You merge live differential-diagnosis dictation for a medical student.
Given PRIOR transcript and a new RAW speech-to-text CHUNK, output the complete updated transcript.

Rules:
- NEVER drop words from PRIOR or CHUNK — include every spoken diagnosis.
- Fix STT garble (e.g. "colcystitis" → "cholecystitis", "PE" stays "PE").
- Turn spoken "comma" / "and" between diagnoses into comma-separated list in flowing prose.
- Strip filler only: "talking about", "it could be", "um", "uh".
- Do not invent diagnoses not spoken in PRIOR or CHUNK.
- Return ONLY the merged plain transcript — no markdown, labels, or commentary.`,
    },
    {
      role: 'user',
      content: `PRIOR:\n${prior || '(empty)'}\n\nNEW CHUNK:\n${chunk}\n\nMERGED TRANSCRIPT:`,
    },
  ], { maxTokens: 600, temperature: 0.1 });

  return merged || `${prior}${prior ? ' ' : ''}${chunk}`.trim();
}

function mimeToExt(mimeType = 'audio/webm') {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

function runLocalWhisper(buffer, mimeType, promptHint = '') {
  return new Promise((resolve, reject) => {
    const ext = mimeToExt(mimeType);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meworld-whisper-'));
    const audioPath = path.join(tmpDir, `clip.${ext}`);
    fs.writeFileSync(audioPath, buffer);

    const args = [WHISPER_SCRIPT, audioPath];
    if (promptHint) args.push(promptHint);

    const child = spawn(whisperPython(), args, {
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        WHISPER_MODEL: whisperModel(),
        WHISPER_DEVICE: process.env.WHISPER_DEVICE || 'cpu',
      },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr.on('data', (d) => {
      stderr += String(d);
    });
    child.on('error', (err) => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      reject(err);
    });
    child.on('close', () => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      try {
        const payload = JSON.parse(stdout.trim() || '{}');
        if (payload.ok && payload.text) {
          resolve({ text: String(payload.text).trim(), provider: 'local', model: payload.model || whisperModel() });
          return;
        }
        reject(new Error(payload.error || stderr.trim() || 'Local Whisper failed'));
      } catch (e) {
        reject(new Error(stderr.trim() || stdout.trim() || String(e.message || e)));
      }
    });
  });
}

async function transcribeWithOpenAI(buffer, mimeType = 'audio/webm', promptHint = '') {
  if (!openaiKey()) return null;
  const ext = mimeToExt(mimeType);
  const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });
  const form = new FormData();
  form.append('file', blob, `clip.${ext}`);
  form.append('model', 'whisper-1');
  form.append('language', 'en');
  if (promptHint) form.append('prompt', promptHint.slice(0, 800));

  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey()}` },
    body: form,
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(err || `Whisper error ${r.status}`);
  }
  const data = await r.json();
  return {
    text: String(data.text || '').trim(),
    provider: 'openai',
    model: 'whisper-1',
  };
}

async function transcribeAudioBuffer(buffer, mimeType = 'audio/webm', promptHint = '') {
  const hint = String(promptHint || '').trim();
  const preferLocal = whisperMode() === 'local' || (whisperMode() === 'auto' && (await probeLocalWhisper()));
  const preferOpenai = whisperMode() === 'openai' || (whisperMode() === 'auto' && !preferLocal);

  if (preferLocal) {
    try {
      return await runLocalWhisper(buffer, mimeType, hint);
    } catch (localErr) {
      if (whisperMode() === 'local' || !voiceNoteWhisperAvailable()) throw localErr;
    }
  }

  if (preferOpenai || voiceNoteWhisperAvailable()) {
    return transcribeWithOpenAI(buffer, mimeType, hint);
  }

  throw new Error('No batch STT available — install faster-whisper or add OPENAI_API_KEY');
}

export async function transcribeAudioChunk(buffer, mimeType = 'audio/webm', promptHint = '') {
  const result = await transcribeAudioBuffer(buffer, mimeType, promptHint);
  return result?.text || '';
}

export async function transcribeFullAudio(
  buffer,
  mimeType = 'audio/webm',
  { promptHint = '', cleanup = true } = {},
) {
  const result = await transcribeAudioBuffer(buffer, mimeType, promptHint);
  const text = String(result?.text || '').trim();
  if (!text) return { transcript: '', provider: result?.provider || null, model: result?.model || null };
  // Verbatim path (e.g. free-form notes): return the raw local/Whisper text
  // exactly as captioned — no LLM "merge" pass to reword it.
  if (!cleanup || !voiceNoteMergeAvailable()) {
    return { transcript: text, provider: result.provider, model: result.model, raw: text };
  }
  const cleaned = await mergeVoiceNoteTranscript('', text);
  return {
    transcript: cleaned || text,
    provider: result.provider,
    model: result.model,
    raw: text,
  };
}

// Warm faster-whisper import in background so first API call isn't slow.
// Use a timer to ensure .env is already loaded by the time it runs.
setTimeout(() => { probeLocalWhisper().catch(() => {}); }, 200);
