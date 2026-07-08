import { readCaseNotes, writeCaseNotes } from './caseNotes.js';

function liveHeader(stamp) {
  return `\n\n---\n**Voice note (live · ${stamp})**\n`;
}

function finalizedHeader(stamp, slot) {
  const slotLabel = slot ? ` #${slot}` : '';
  return `\n\n---\n**Voice note${slotLabel} · ${stamp}**\n`;
}

function findLiveBlock(existing) {
  const marker = '\n\n---\n**Voice note (live';
  const idx = existing.lastIndexOf(marker);
  if (idx === -1) return null;
  const headerLineEnd = existing.indexOf('\n', idx + marker.length);
  if (headerLineEnd === -1) return null;
  const bodyStart = headerLineEnd + 1;
  const tail = existing.slice(bodyStart);
  const nextIdx = tail.search(/\n\n---\n\*\*Voice note #|\n\n---\n\*\*Voice note ·/);
  const bodyEnd = nextIdx >= 0 ? bodyStart + nextIdx : existing.length;
  return {
    prefix: existing.slice(0, idx),
    header: existing.slice(idx, bodyStart),
    body: existing.slice(bodyStart, bodyEnd),
    suffix: existing.slice(bodyEnd),
  };
}

export function beginLiveVoiceNote(caseId) {
  const stamp = new Date().toLocaleTimeString();
  const existing = readCaseNotes(caseId);
  writeCaseNotes(caseId, `${existing}${liveHeader(stamp)}`);
  return stamp;
}

export function updateLiveVoiceNote(caseId, transcript) {
  const existing = readCaseNotes(caseId);
  let block = findLiveBlock(existing);
  if (!block) {
    beginLiveVoiceNote(caseId);
    block = findLiveBlock(readCaseNotes(caseId));
  }
  if (!block) return;
  const body = String(transcript || '').trim();
  writeCaseNotes(caseId, `${block.prefix}${block.header}${body}${block.suffix}`);
}

export function finalizeLiveVoiceNote(caseId, transcript, { slot = null, stamp = null } = {}) {
  const existing = readCaseNotes(caseId);
  const block = findLiveBlock(existing);
  const body = String(transcript || '').trim();
  const time = stamp || new Date().toLocaleTimeString();

  if (!block) {
    if (!body) return;
    writeCaseNotes(caseId, `${existing}${finalizedHeader(time, slot)}${body}`);
    return;
  }

  const finalBlock = body ? `${finalizedHeader(time, slot)}${body}` : '';
  writeCaseNotes(caseId, `${block.prefix}${finalBlock}${block.suffix}`);
}
