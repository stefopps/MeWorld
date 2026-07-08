import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { caseStoryImagePath } from './caseStoryCache.js';

function normalizeCaseFile(caseId) {
  const num = String(caseId || '').replace(/^case_/i, '').trim();
  return num ? `case_${num.padStart(3, '0')}` : null;
}

/** `dev/case-story/case_051-CHARACTER-LOCK.md` */
export function caseStoryCharacterLockPath(rootDir, caseId) {
  const slug = normalizeCaseFile(caseId);
  return slug
    ? path.join(rootDir, 'dev', 'case-story', `${slug}-CHARACTER-LOCK.md`)
    : null;
}

export async function readCaseStoryCharacterLock(rootDir, caseId) {
  const file = caseStoryCharacterLockPath(rootDir, caseId);
  if (!file || !fs.existsSync(file)) return null;
  try {
    return (await fsp.readFile(file, 'utf8')).trim() || null;
  } catch {
    return null;
  }
}

/** Default beat framing when no per-case lock file exists. */
export const DEFAULT_BEAT_COMPOSITION = {
  c0: 'Domestic wide — patient in home bedroom or living room, morning window light, NOT hospital; same likeness in home clothes or pajamas',
  c1: 'MCU — patient left-third of frame, environmental depth in background, NOT symmetrical dead-center',
  c2: 'Medium three-quarter — patient center-left, props monitor upper-right / IV upper-left',
  c3: 'Wide establishing — patient right-third, room depth and equipment visible',
  c4: 'Medium — patient lower third, foreground prop or rail occlusion for depth',
  c5: 'Wide with family or context in mid-background — patient upper-left third',
  c6: 'MCU resolution — patient calmer, treatment implied, emotional beat — rule-of-thirds, not dead-center',
};

export function beatCompositionDirective(beatId, { lockMarkdown = '' } = {}) {
  const id = String(beatId || '').trim().toLowerCase();
  if (lockMarkdown) {
    const rowRe = new RegExp(
      `\\|\\s*\\*\\*${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*\\s*\\|[^|]*\\|([^|]+)\\|`,
      'i',
    );
    const m = lockMarkdown.match(rowRe);
    if (m?.[1]) return m[1].trim();
  }
  return DEFAULT_BEAT_COMPOSITION[id] || DEFAULT_BEAT_COMPOSITION.c2;
}

export function extractCharacterAnchorBlock(lockMarkdown) {
  if (!lockMarkdown) return '';
  const start = lockMarkdown.indexOf('## Locked character');
  if (start < 0) return '';
  const rest = lockMarkdown.slice(start);
  const end = rest.search(/\n## (?!Locked)/);
  const section = end > 0 ? rest.slice(0, end) : rest;
  return section
    .replace(/^## Locked character[^\n]*\n+/i, '')
    .replace(/^---\s*$/gm, '')
    .trim();
}

export function extractStyleLockBlock(lockMarkdown) {
  if (!lockMarkdown) return '';
  const start = lockMarkdown.indexOf('## Style lock');
  if (start < 0) return '';
  const rest = lockMarkdown.slice(start);
  const end = rest.search(/\n## (?!Style)/);
  const section = end > 0 ? rest.slice(0, end) : rest;
  return section
    .replace(/^## Style lock[^\n]*\n+/i, '')
    .replace(/^---\s*$/gm, '')
    .trim();
}

export function buildCharacterLockPromptSection(lockMarkdown, { beatsOnly = false } = {}) {
  if (!lockMarkdown) return '';
  const anchor = extractCharacterAnchorBlock(lockMarkdown);
  const style = extractStyleLockBlock(lockMarkdown);
  const parts = [];
  if (anchor) {
    parts.push(
      beatsOnly
        ? `CHARACTER LOCK (match master — age/hair/face/gown invariant):\n${anchor}`
        : `CHARACTER LOCK (match master reference exactly — verbatim):\n${anchor}`,
    );
  }
  if (!beatsOnly && style) parts.push(`STYLE LOCK:\n${style}`);
  return parts.join('\n\n');
}

export async function readMasterImageBase64(cacheDir, caseId) {
  const masterPath = caseStoryImagePath(cacheDir, caseId);
  if (!masterPath || !fs.existsSync(masterPath)) return null;
  const buf = await fsp.readFile(masterPath);
  return { buffer: buf, mimeType: 'image/png', path: masterPath };
}
