import { parseCaseNoteBlocks } from './caseNotes.js';
import { listCaseYoutubeTranscripts } from './caseYoutubeTranscripts.js';
import { recordingPublicUrl } from './caseUserLog.js';

export { parseCaseNoteBlocks } from './caseNotes.js';

export function parseNoteBubbleContent(content) {
  const raw = String(content || '').trim();
  const headerMatch = raw.match(/^\*\*(.+?)\*\*\s*\n?([\s\S]*)$/);
  if (headerMatch) {
    return { header: headerMatch[1], body: headerMatch[2].trim() };
  }
  return { header: 'Note', body: raw };
}

function sortKeyFromAt(at, fallbackIndex = 0) {
  if (at) {
    const t = new Date(at).getTime();
    if (Number.isFinite(t)) return t;
  }
  // Undated live chat rows keep stable order at the end.
  return 1e15 + fallbackIndex;
}

const notePlain = (text) =>
  String(text || '')
    .replace(/^\*\*.+?\*\*\s*\n?/, '')
    .trim()
    .toLowerCase();

export function mergeSessionThread(chatMessages = [], caseId, { recordings = [] } = {}) {
  const chatRows = [];
  const noteRows = [];
  const youtubeRows = [];
  const voiceRows = [];
  const seen = new Set();
  const seenNoteText = new Set();
  const replayUrlsInNotes = new Set();

  let chatIdx = 0;
  for (const m of chatMessages) {
    const content = String(m.content || '').trim();
    if (!content) continue;
    const key = `${m.role}:${m.at || ''}:${content}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (m.role === 'note') seenNoteText.add(notePlain(content));
    const replay = content.match(/\]\(([^)]+\.(?:webm|mp3|wav|m4a|ogg)[^)]*)\)/i);
    if (replay?.[1]) replayUrlsInNotes.add(replay[1]);
    chatRows.push({
      id: key,
      role: m.role === 'note' ? 'note' : m.role,
      content,
      source: 'chat',
      sortAt: sortKeyFromAt(m.at, chatIdx++),
    });
  }

  for (const block of parseCaseNoteBlocks(caseId)) {
    const content = block.content.trim();
    if (!content) continue;
    const plain = notePlain(content);
    if (!plain || seenNoteText.has(plain)) continue;
    const key = `note:${content}`;
    if (seen.has(key)) continue;
    seen.add(key);
    seenNoteText.add(plain);
    const replay = content.match(/\]\(([^)]+\.(?:webm|mp3|wav|m4a|ogg)[^)]*)\)/i);
    if (replay?.[1]) replayUrlsInNotes.add(replay[1]);
    noteRows.push({
      id: key,
      role: 'note',
      content: block.header ? `**${block.header}**\n${content}` : content,
      source: 'notes',
      sortAt: block.sortAt ?? 0,
    });
  }

  for (const video of listCaseYoutubeTranscripts(caseId)) {
    const body = String(video.text || '').trim();
    if (!body) continue;
    const header = `YouTube transcript · ${video.title || video.youtubeId}`;
    const preview = body.length > 600 ? `${body.slice(0, 600)}…` : body;
    const content = `**${header}**\n${preview}`;
    const plain = notePlain(preview);
    if (!plain || seenNoteText.has(plain)) continue;
    const key = `youtube:${video.youtubeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    seenNoteText.add(plain);
    youtubeRows.push({
      id: key,
      role: 'note',
      content,
      source: 'youtube',
      sortAt: video.sortAt ?? 0,
    });
  }

  for (const rec of recordings) {
    const src = recordingPublicUrl(rec.file);
    if (!src || replayUrlsInNotes.has(src)) continue;
    const key = `voice:${rec.id || rec.slot || src}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const secs = Math.round((rec.durationMs || 0) / 1000);
    voiceRows.push({
      id: key,
      role: 'voice',
      content: `Voice note #${rec.slot || '?'}${rec.attempt ? ` · Run ${rec.attempt}` : ''} · ${secs}s`,
      source: 'recording',
      sortAt: sortKeyFromAt(rec.at, 0),
      recording: { ...rec, src },
    });
  }

  const merged = [...noteRows, ...youtubeRows, ...chatRows, ...voiceRows];
  merged.sort((a, b) => {
    const ta = a.sortAt ?? 0;
    const tb = b.sortAt ?? 0;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
  return merged;
}
