import fsp from 'fs/promises';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { readCaseUser } from './userCaseStore.js';
import { readPortraitCache, normalizeCaseId } from './casePortrait.js';

const MAX_OCR = 14000;
const MAX_JSON = 12000;
const MAX_CLIENT = 10000;
const MAX_MARKDOWN = 18000;

export function caseBriefFileName(caseId) {
  const slug = normalizeCaseId(caseId);
  return slug ? `${slug}.md` : null;
}

function clip(text, max) {
  const s = String(text || '').trim();
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}\n\n…[truncated]`;
}

export async function loadCaseJson(casesDir, caseId) {
  const num = String(caseId).replace(/^case_/i, '');
  const filePath = path.join(casesDir, `case_${num}.json`);
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function loadCaseOcr(casesDir, caseId) {
  const num = String(caseId).replace(/^case_/i, '');
  const filePath = path.join(casesDir, `case_${num}_ocr.txt`);
  try {
    return clip(await fsp.readFile(filePath, 'utf8'), MAX_OCR);
  } catch {
    return '';
  }
}

async function loadDifferentialReviewEntry(reviewPath, caseId) {
  try {
    const raw = await fsp.readFile(reviewPath, 'utf8');
    const bank = JSON.parse(raw);
    const id = String(caseId);
    let list = [];
    if (Array.isArray(bank)) list = bank;
    else if (bank.cases) {
      list = Array.isArray(bank.cases) ? bank.cases : Object.values(bank.cases);
    }
    return list.find((c) => String(c.caseId) === id) || bank.cases?.[id] || null;
  } catch {
    return null;
  }
}

export function hashRawBundle(bundle) {
  return crypto.createHash('sha256').update(JSON.stringify(bundle)).digest('hex').slice(0, 16);
}

/** Collect all server-side raw inputs for one case. */
export async function loadCaseRawBundle({
  casesDir,
  reviewPath,
  portraitDir,
  caseId,
  clientDiscussion = null,
  clientContext = null,
}) {
  const [caseJson, ocr, review, userCase, portrait] = await Promise.all([
    loadCaseJson(casesDir, caseId),
    loadCaseOcr(casesDir, caseId),
    loadDifferentialReviewEntry(reviewPath, caseId),
    readCaseUser(caseId, { migrate: true }).catch(() => null),
    readPortraitCache(portraitDir, caseId),
  ]);

  const userChat = (userCase?.chatHistory || []).slice(-40).map((m) => ({
    at: m.at,
    role: m.role,
    content: clip(m.content, 500),
  }));

  const userRecordings = (userCase?.recordings || []).slice(-20).map((r) => ({
    at: r.at,
    durationMs: r.durationMs,
    slot: r.slot,
  }));

  return {
    caseId: String(caseId),
    caseJson: caseJson || null,
    ocrText: ocr || null,
    differentialReview: review
      ? {
          topic: review.topic,
          diagnosis: review.diagnosis,
          hpiNarrative: clip(review.hpiNarrative || review.history, 2000),
          ordersText: clip(review.ordersText, 3000),
          caseSummary: clip(review.caseSummary, 1500),
        }
      : null,
    portraitPersona: portrait.meta?.persona || portrait.meta?.analysis?.persona || null,
    serverChat: userChat,
    serverRecordings: userRecordings,
    clientDiscussion: clientDiscussion || null,
    clientContext: clientContext
      ? {
          patientName: clientContext.patientName,
          patientFacts: clientContext.patientFacts,
          hpiExcerpt: clientContext.hpiExcerpt,
          chief_complaint: clientContext.chief_complaint,
        }
      : null,
    collectedAt: new Date().toISOString(),
  };
}

export async function synthesizeCaseBriefMarkdown(key, bundle, callChat) {
  const system = `You reorganize medical training case raw data into one clear Markdown dossier.
Rules:
- Output Markdown only (no JSON wrapper).
- Start with "# Case {id} — {title or topic}"
- Sections: Patient & presentation · Chief complaint & HPI · Exam & vitals · Diagnosis & pearls · Orders & rationale · Learner activity (transcripts, chat, notes) · Portrait/persona (if any) · Raw constants (compact bullet list of stable facts)
- Merge OCR, case JSON, and transcripts — dedupe, fix obvious OCR typos.
- Label uncertain items as (inferred) vs (documented).
- Keep learner voice transcripts quoted briefly under Learner activity.
- End with "## Raw source index" listing what inputs were used.`;

  const user = `Organize this case dossier from RAW DATA:

${clip(JSON.stringify(bundle, null, 2), MAX_OCR + MAX_JSON + MAX_CLIENT)}

Produce the Markdown dossier now.`;

  const markdown = await callChat(key, [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);

  return clip(markdown, MAX_MARKDOWN);
}

export async function readBriefCache(briefDir, caseId) {
  const fileName = caseBriefFileName(caseId);
  if (!fileName) return { exists: false };
  const mdPath = path.join(briefDir, fileName);
  const metaPath = path.join(briefDir, fileName.replace(/\.md$/i, '.meta.json'));
  try {
    await fsp.access(mdPath);
    const markdown = await fsp.readFile(mdPath, 'utf8');
    let meta = {};
    try {
      meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
    } catch {
      /* no meta */
    }
    return { exists: true, fileName, mdPath, markdown, meta };
  } catch {
    return { exists: false, fileName, mdPath };
  }
}

export async function writeBriefCache(briefDir, caseId, markdown, meta = {}) {
  const fileName = caseBriefFileName(caseId);
  if (!fileName) throw new Error('Invalid case id');
  const mdPath = path.join(briefDir, fileName);
  const metaPath = path.join(briefDir, fileName.replace(/\.md$/i, '.meta.json'));
  await fsp.writeFile(mdPath, markdown, 'utf8');
  const payload = {
    caseId: normalizeCaseId(caseId),
    cachedAt: new Date().toISOString(),
    ...meta,
  };
  await fsp.writeFile(metaPath, JSON.stringify(payload, null, 2), 'utf8');
  return { fileName, mdPath, meta: payload };
}

export function ensureBriefDir(briefDir) {
  if (!fs.existsSync(briefDir)) fs.mkdirSync(briefDir, { recursive: true });
}
