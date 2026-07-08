import { readCaseNotes } from './caseNotes.js';
import { summarizePictureNotesForChat } from './casePictureNotes.js';
import { readLocalChatHistory } from './caseUserLog.js';
import { readCaseMemoryMeta } from './differentialCaseMemory.js';
import { getAttemptsForCase, readCaseTranscriptArchive } from './differentialPracticeLog.js';
import { listLocalDifferentialRecordings } from './differentialVoiceStorage.js';
import { listCaseYoutubeTranscripts } from './caseYoutubeTranscripts.js';

const MAX_VOICE = 12;
const MAX_DIFF_ATTEMPTS = 10;
const MAX_CHAT = 30;
const MAX_NOTE_CHARS = 4000;

function clip(text, max = 600) {
  const s = String(text || '').trim();
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function uniqueTranscriptRows(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = `${row.at || ''}:${row.source}:${row.text}`;
    if (!row.text || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  out.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  return out;
}

/** Case-specific transcripts + prior chat for rich patient_sim discussion. */
export function buildCaseDiscussionContext(caseId) {
  const id = String(caseId || '');
  if (!id) return null;

  const memory = readCaseMemoryMeta(id);
  const voiceRows = listLocalDifferentialRecordings(id)
    .filter((r) => r.transcript?.trim())
    .slice(0, MAX_VOICE)
    .map((r) => ({
      at: r.at || null,
      source: 'voice_recording',
      transcript: clip(r.transcript, 800),
      durationMs: r.durationMs || 0,
    }));

  const diffAttempts = getAttemptsForCase(id)
    .slice(-MAX_DIFF_ATTEMPTS)
    .map((a) => ({
      at: a.at,
      source: 'differential_attempt',
      rawTranscript: clip(a.rawTranscript, 800),
      cleanedTranscript: clip(a.cleanedTranscript, 800),
      guesses: (a.guesses || []).slice(0, 12),
      aiSummary: clip(a.aiSummary, 400),
      revealed: Boolean(a.revealed),
      score: a.revealed && a.total ? `${a.correct}/${a.total}` : null,
    }))
    .filter(
      (a) =>
        a.rawTranscript ||
        a.cleanedTranscript ||
        a.guesses.length ||
        a.aiSummary,
    );

  const archiveBucket = readCaseTranscriptArchive().cases[id];
  const archiveRows = (archiveBucket?.attempts || [])
    .slice(-MAX_DIFF_ATTEMPTS)
    .map((a) => ({
      at: a.at,
      source: 'transcript_archive',
      rawTranscript: clip(a.rawTranscript, 800),
      cleanedTranscript: clip(a.cleanedTranscript, 800),
      guesses: (a.guesses || []).slice(0, 12),
    }))
    .filter((a) => a.rawTranscript || a.cleanedTranscript || a.guesses.length);

  const priorChat = readLocalChatHistory(id)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_CHAT)
    .map((m) => ({
      at: m.at || null,
      role: m.role,
      content: clip(m.content, 700),
    }));

  const learnerNotes = clip(readCaseNotes(id), MAX_NOTE_CHARS);
  const pictureNotes = summarizePictureNotesForChat(id);
  const memoryHook =
    memory.text && memory.text !== learnerNotes ? clip(memory.text, 500) : null;

  const youtubeTranscripts = listCaseYoutubeTranscripts(id)
    .slice(-6)
    .map((v) => ({
      youtubeId: v.youtubeId,
      title: v.title || 'YouTube',
      transcript: clip(v.text, 1200),
      savedAt: v.savedAt || null,
    }))
    .filter((v) => v.transcript);

  const voiceTranscripts = uniqueTranscriptRows(
    [
      ...voiceRows.map((v) => ({
        at: v.at,
        source: v.source,
        text: v.transcript,
      })),
      ...diffAttempts
        .filter((a) => a.rawTranscript || a.cleanedTranscript)
        .map((a) => ({
          at: a.at,
          source: a.source,
          text: a.cleanedTranscript || a.rawTranscript,
        })),
      ...archiveRows
        .filter((a) => a.rawTranscript || a.cleanedTranscript)
        .map((a) => ({
          at: a.at,
          source: a.source,
          text: a.cleanedTranscript || a.rawTranscript,
        })),
    ].filter((r) => r.text),
  ).slice(-MAX_VOICE);

  const hasContent =
    memory.text ||
    voiceTranscripts.length ||
    diffAttempts.length ||
    priorChat.length ||
    learnerNotes ||
    pictureNotes.length ||
    youtubeTranscripts.length;

  if (!hasContent) return null;

  return {
    caseId: id,
    memoryHook,
    voiceTranscripts,
    youtubeTranscripts,
    differentialAttempts: diffAttempts,
    priorPatientChat: priorChat,
    learnerNotes: learnerNotes || null,
    pictureNotes: pictureNotes.length ? pictureNotes : null,
    updatedAt: new Date().toISOString(),
  };
}

export function discussionCacheKey(discussion) {
  if (!discussion) return '';
  try {
    return JSON.stringify({
      v: discussion.voiceTranscripts?.length || 0,
      d: discussion.differentialAttempts?.length || 0,
      c: discussion.priorPatientChat?.length || 0,
      m: discussion.memoryHook || '',
      n: (discussion.learnerNotes || '').length,
      p: discussion.pictureNotes?.length || 0,
      lastPic: discussion.pictureNotes?.at(-1)?.at || null,
      y: discussion.youtubeTranscripts?.length || 0,
      lastVoice: discussion.voiceTranscripts?.at(-1)?.at || null,
      lastChat: discussion.priorPatientChat?.at(-1)?.at || null,
      lastYoutube: discussion.youtubeTranscripts?.at(-1)?.savedAt || null,
    });
  } catch {
    return '';
  }
}
